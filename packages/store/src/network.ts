import { Libp2p, createLibp2p } from "libp2p"

import { SignedMessage } from "@libp2p/interface-pubsub"
import { PeerId } from "@libp2p/interface-peer-id"
import { logger } from "@libp2p/logger"
import * as varint from "big-varint"
import { anySignal } from "any-signal"

import Discovery from "#protocols/discovery"

import { DiscoveryRecordCache } from "./discovery/index.js"

import { getLibp2pOptions } from "./libp2p.js"

import {
	DISCOVERY_ANNOUNCE_DELAY,
	DISCOVERY_ANNOUNCE_INTERVAL,
	DISCOVERY_ANNOUNCE_RETRY_INTERVAL,
	DISCOVERY_TOPIC,
	PING_DELAY,
	PING_INTERVAL,
	PING_TIMEOUT,
} from "./constants.js"
import { keyPattern, keyPrefix, retry, wait } from "./utils.js"
import { MemoryCache } from "./index.js"

export interface NetworkConfig {
	listen?: string[]
	announce?: string[]
	bootstrapList?: string[]
	minConnections?: number
	maxConnections?: number
}

export class Network {
	private readonly log = logger("canvas:network")
	private readonly controller = new AbortController()
	private readonly cache = new MemoryCache(this.controller.signal)

	public static async open(peerId: PeerId, config: NetworkConfig): Promise<Network> {
		const libp2p = await createLibp2p(getLibp2pOptions(peerId, config))
		return new Network(libp2p)
	}

	private constructor(public readonly libp2p: Libp2p) {
		libp2p.fetchService.registerLookupFunction(keyPrefix, async (key) => {
			const result = keyPattern.exec(key)
			if (result === null) {
				return null
			}

			const [_, topic] = result
			const records = this.cache.query(topic)
			return Discovery.FetchPeersResponse.encode({ records }).finish()
		})

		libp2p.addEventListener("peer:connect", ({ detail: { id, remotePeer } }) => {
			this.log("opened connection %s to peer %p", id, remotePeer)
		})

		libp2p.addEventListener("peer:disconnect", ({ detail: { id, remotePeer } }) => {
			this.log("closed connection %s to peer %p", id, remotePeer)
		})

		this.startDiscoveryService()
		this.startPingService()
	}

	public async stop(): Promise<void> {
		this.controller.abort()
		await Promise.all(this.libp2p.getConnections().map((connection) => connection.close()))
		await this.libp2p.stop()
	}

	private async startPingService() {
		const log = logger("canvas:network:ping")
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
		const log = logger("canvas:network:discovery")
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

						const record = Discovery.DiscoveryRecord.encode({
							addrs: addrs.map((addr) => addr.bytes),
							topics: this.libp2p.pubsub.getTopics(),
						}).finish()

						const { recipients } = await this.libp2p.pubsub.publish(DISCOVERY_TOPIC, record)
						if (recipients.length === 0) {
							throw new Error("no GossipSub peers")
						}

						log(`published discovery record to %d peers`, recipients.length)
					},
					(err, i) => log.error("failed to publish discovery record: %O", err),
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
			const record = Discovery.DiscoveryRecord.decode(msg.data)
			this.log("received discovery record from %p for topics %o", msg.from, record.topics)

			this.cache.insert(
				record.topics,
				Discovery.SignedDiscoveryRecord.create({
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
