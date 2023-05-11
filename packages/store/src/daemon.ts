import { Libp2p, createLibp2p } from "libp2p"

import { SignedMessage } from "@libp2p/interface-pubsub"
import { PeerId } from "@libp2p/interface-peer-id"

import * as varint from "big-varint"

import { logger } from "@libp2p/logger"
import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from "@libp2p/peer-id-factory"
import { base64 } from "multiformats/bases/base64"

import { DiscoveryRecordCache } from "./discovery/index.js"

import { DiscoveryRecord, FetchDiscoveryRecordsResponse, SignedDiscoveryRecord } from "#protocols/discovery"

import { NetworkConfig, getLibp2pOptions } from "./libp2p.js"

import {
	DISCOVERY_ANNOUNCE_DELAY,
	DISCOVERY_ANNOUNCE_INTERVAL,
	DISCOVERY_ANNOUNCE_RETRY_INTERVAL,
	DISCOVERY_TOPIC,
	FETCH_TIMEOUT,
	MIN_TOPIC_PEERS,
	PING_DELAY,
	PING_INTERVAL,
	PING_TIMEOUT,
} from "./constants.js"
import { retry, wait } from "./utils.js"
import { anySignal } from "any-signal"

export interface DaemonConfig extends NetworkConfig {
	cache: DiscoveryRecordCache
	getPrivateKey: () => Promise<string | null>
	setPrivateKey: (privateKey: string) => Promise<void>
}

export class Daemon {
	private readonly controller = new AbortController()
	private readonly log = logger("canvas:daemon")

	public static async open(config: DaemonConfig): Promise<Daemon> {
		const peerId = await Daemon.getPeerId(config)
		const libp2p = await createLibp2p(getLibp2pOptions(peerId, config))
		return new Daemon(libp2p, config.cache)
	}

	private static async getPeerId(config: DaemonConfig): Promise<PeerId> {
		const privateKey = await config.getPrivateKey()
		if (privateKey === null) {
			const peerId = await createEd25519PeerId()
			const privateKeyBytes = exportToProtobuf(peerId)
			const privateKey = base64.baseEncode(privateKeyBytes)
			await config.setPrivateKey(privateKey)
			return peerId
		} else {
			const privateKeyBytes = base64.baseDecode(privateKey)
			return await createFromProtobuf(privateKeyBytes)
		}
	}

	private constructor(public readonly libp2p: Libp2p, private readonly cache: DiscoveryRecordCache) {
		const keyPrefix = "/canvas/v0/store/"
		const keyPattern = /^\/canvas\/v0\/store\/([a-zA-Z0-9:\.\-]+)\/peers$/
		libp2p.fetchService.registerLookupFunction(keyPrefix, async (key) => {
			const result = keyPattern.exec(key)
			if (result === null) {
				return null
			}

			const [_, topic] = result
			const records = this.cache.query(topic)
			return FetchDiscoveryRecordsResponse.encode({ records }).finish()
		})

		libp2p.addEventListener("peer:connect", async ({ detail: connection }) => {
			for (const topic of this.libp2p.pubsub.getTopics()) {
				if (topic.startsWith(keyPrefix)) {
					const subscribers = this.libp2p.pubsub.getSubscribers(topic)
					if (subscribers.length < MIN_TOPIC_PEERS) {
						const signal = anySignal([AbortSignal.timeout(FETCH_TIMEOUT), this.controller.signal])
						await libp2p
							.fetch(connection.remotePeer, `${topic}/peers`, { signal })
							.then((value) => {})
							.catch((err) =>
								this.log("failed to fetch peers for topic %s from %p: %O", topic, connection.remotePeer, err)
							)
							.finally(() => signal.clear())

						let value: Uint8Array | null = null
						try {
							value = await libp2p.fetch(connection.remotePeer, `${topic}/peers`, { signal })
						} catch (err) {
							this.log("failed to fetch peers for topic %s from %p", topic, connection.remotePeer)
							return
						} finally {
							signal.clear()
						}
					}
				}
			}
		})

		this.startDiscoveryService()
		this.startPingService()
	}

	public async stop(): Promise<void> {
		this.controller.abort()
		await this.libp2p.stop()
	}

	private async startPingService() {
		const log = logger("canvas:daemon:ping")
		log("started ping service")

		const { signal } = this.controller
		try {
			await wait(PING_DELAY, { signal })
			while (!signal.aborted) {
				const peers = this.libp2p.getPeers()
				await Promise.all(
					peers.map(async (peer) => {
						const timeoutSignal = anySignal([AbortSignal.timeout(PING_TIMEOUT), signal])
						try {
							const latency = await this.libp2p.ping(peer, { signal: timeoutSignal })
							log("peer %p responded to ping in %dms", peer, latency)
						} catch (err) {
							log("peer %p failed to respond to ping", peer)
							await this.libp2p.hangUp(peer)
						} finally {
							timeoutSignal.clear()
						}
					})
				)

				await wait(PING_INTERVAL, { signal })
			}
		} catch (err) {
			if (signal.aborted) {
				log("service aborted")
			} else {
				log.error("service crashed: %o", err)
			}
		}
	}

	private async startDiscoveryService() {
		const log = logger("canvas:daemon:discovery")
		log("started discovery service")

		this.libp2p.pubsub.addEventListener("message", ({ detail: msg }) => {
			if (msg.type === "signed" && msg.topic === DISCOVERY_TOPIC) {
				this.handleDiscoveryRecord(msg)
			}
		})

		const { signal } = this.controller
		try {
			await wait(DISCOVERY_ANNOUNCE_DELAY, { signal })
			while (!signal.aborted) {
				await retry(
					async () => {
						const addrs = this.libp2p.getMultiaddrs()
						if (addrs.length === 0) {
							throw new Error("no multiaddrs to announce")
						}

						const record = DiscoveryRecord.encode({
							addrs: addrs.map((addr) => addr.bytes),
							topics: this.libp2p.pubsub.getTopics(),
						}).finish()

						const { recipients } = await this.libp2p.pubsub.publish(DISCOVERY_TOPIC, record)
						if (recipients.length === 0) {
							throw new Error("no GossipSub peers")
						}

						log(`published discovery record to %d peers`, recipients.length)
					},
					(err, i) => log.error("failed to publish discovery record: %o", err),
					{ signal, maxRetries: 3, interval: DISCOVERY_ANNOUNCE_RETRY_INTERVAL }
				)

				await wait(DISCOVERY_ANNOUNCE_INTERVAL, { signal })
			}
		} catch (err) {
			if (signal.aborted) {
				log("service aborted")
			} else {
				log.error("service crashed: %o", err)
			}
		}
	}

	private handleDiscoveryRecord(msg: SignedMessage) {
		try {
			const record = DiscoveryRecord.decode(msg.data)
			this.log("received discovery record from %p for topics %o", msg.from, record.topics)

			this.cache.insert(
				record.topics,
				SignedDiscoveryRecord.create({
					from: msg.from.toBytes(),
					data: msg.data,
					seqno: varint.unsigned.encode(msg.sequenceNumber),
					signature: msg.signature,
					key: msg.key,
				})
			)
		} catch (err) {
			this.log.error("received invalid discovery record: %o", msg)
		}
	}
}
