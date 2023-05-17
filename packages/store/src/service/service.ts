import { EventEmitter } from "@libp2p/interfaces/events"
import { Startable } from "@libp2p/interfaces/startable"
import { PeerId } from "@libp2p/interface-peer-id"
import { Connection, Stream } from "@libp2p/interface-connection"
import { StreamHandler, Topology, Registrar } from "@libp2p/interface-registrar"
import { ConnectionManager } from "@libp2p/interface-connection-manager"
import { Message } from "@libp2p/interface-pubsub"

import * as lp from "it-length-prefixed"
import { pipe } from "it-pipe"

import { bytesToHex as hex } from "@noble/hashes/utils"

import { GossipSub } from "@chainsafe/libp2p-gossipsub"
import { logger } from "@libp2p/logger"
import { createTopology } from "@libp2p/topology"

import type { Source, Target, KeyValueStore } from "@canvas-js/okra"

import { Driver, Client, Server, decodeRequests, encodeResponses } from "#sync"

import { minute } from "@canvas-js/store/constants"
import { Entry, decodeEntry, encodeEntry } from "../utils.js"

export interface AbstractTree {
	close(): Promise<void>
	read(callback: (txn: Source) => Promise<void>): Promise<void>
	write(callback: (txn: Target & Pick<KeyValueStore, "get" | "set" | "delete">) => Promise<void>): Promise<void>
}

export interface StoreInit {
	location: string
	topic: string
	apply: (key: Uint8Array, value: Uint8Array) => Promise<void>

	minConnections?: number
	maxConnections?: number
	maxInboundStreams?: number
	maxOutboundStreams?: number
}

export interface StoreService {
	insert(key: Uint8Array, value: Uint8Array): Promise<void>
	get(key: Uint8Array): Promise<Uint8Array | null>
}

export interface StoreComponents {
	peerId: PeerId
	registrar: Registrar
	connectionManager: ConnectionManager
}

export class StoreService extends EventEmitter<{}> implements StoreService, Startable {
	public static MIN_CONNECTIONS = 2
	public static MAX_CONNECTIONS = 10
	public static MAX_INBOUND_STREAMS = 64
	public static MAX_OUTBOUND_STREAMS = 64
	public static MAX_SYNC_QUEUE_SIZE = 8
	public static SYNC_COOLDOWN_PERIOD = 2 * minute

	private static extractGossipSub(components: StoreComponents): GossipSub {
		const { pubsub } = components as StoreComponents & { pubsub?: GossipSub }
		if (pubsub === undefined) {
			throw new Error("missing pubsub service")
		} else {
			return pubsub
		}

		// if (pubsub instanceof GossipSub) {
		// 	return pubsub
		// } else if (pubsub !== undefined) {
		// 	throw new Error("pubsub service is not a GossipSub instance")
		// } else {
		// 	throw new Error("missing pubsub service")
		// }
	}

	private readonly minConnections: number
	private readonly maxConnections: number
	private readonly maxInboundStreams: number
	private readonly maxOutboundStreams: number

	private readonly log = logger("canvas:store:service")
	private readonly pubsub: GossipSub
	private readonly topic: string
	private readonly protocol: string
	private readonly topology: Topology
	private registrarId: string | null = null

	constructor(
		private readonly components: StoreComponents,
		private readonly init: StoreInit,
		private readonly tree: AbstractTree
	) {
		super()

		this.topic = `/canvas/v0/store/${init.topic}`
		this.protocol = `/canvas/v0/store/${init.topic}/sync`

		this.minConnections = init.minConnections ?? StoreService.MIN_CONNECTIONS
		this.maxConnections = init.maxConnections ?? StoreService.MAX_CONNECTIONS
		this.maxInboundStreams = init.maxInboundStreams ?? StoreService.MAX_INBOUND_STREAMS
		this.maxOutboundStreams = init.maxOutboundStreams ?? StoreService.MAX_OUTBOUND_STREAMS

		this.pubsub = StoreService.extractGossipSub(components)
		this.topology = createTopology({
			min: this.minConnections,
			max: this.maxConnections,

			onConnect: (peerId, connection) => {
				this.topology.peers.add(peerId.toString())
				this.handleConnect(connection)
			},

			onDisconnect: (peerId) => {
				this.topology.peers.delete(peerId.toString())
			},
		})
	}

	get [Symbol.toStringTag](): "@canvas-js/store/service" {
		return "@canvas-js/store/service"
	}

	public isStarted(): boolean {
		return this.registrarId !== null
	}

	public start() {
		this.pubsub.addEventListener("message", this.handleMessage)

		this.components.registrar.handle(this.protocol, this.handleIncomingStream, {
			maxInboundStreams: this.maxInboundStreams,
			maxOutboundStreams: this.maxOutboundStreams,
		})

		this.components.registrar.register(this.protocol, this.topology).then((registrarId) => {
			this.registrarId = registrarId
		})
	}

	public afterStart() {
		this.pubsub.subscribe(this.topic)
	}

	public beforeStop(): void {
		// I'm pretty sure this is not necessary at all but w/e
		this.pubsub.unsubscribe(this.topic)
	}

	public stop(): void {
		if (this.registrarId !== null) {
			this.components.registrar.unregister(this.registrarId)
		}

		this.tree.close()
	}

	public async insert(key: Uint8Array, value: Uint8Array) {
		await this.init.apply(key, value)
		await this.tree.write(async (txn) => txn.set(key, value))
		try {
			const data = encodeEntry({ key, value })
			const { recipients } = await this.pubsub.publish(this.topic, data)
			this.log("published entry to %d recipients", recipients.length)
		} catch (err) {
			this.log.error("failed to publish entry: %O", err)
		}
	}

	private handleMessage = async ({ detail: msg }: CustomEvent<Message>) => {
		if (msg.type !== "signed" || msg.topic !== this.topic) {
			return
		}

		let entry: Entry | null = null
		try {
			entry = decodeEntry(msg.data)
		} catch (err) {
			this.log.error("received invalid insertion record: %O", err)
			return
		}

		const { key, value } = entry

		try {
			await this.init.apply(key, value)
		} catch (err) {
			this.log.error("failed to apply entry: %O", err)
			return
		}

		try {
			await this.tree.write(async (txn) => txn.set(key, value))
			this.log("successfully committed entry")
		} catch (err) {
			this.log.error("failed to commit entry: %O", err)
		}
	}

	private handleIncomingStream: StreamHandler = async ({ connection, stream }) => {
		this.log("opened incoming stream %s from peer %p", stream.id, connection.remotePeer)
		try {
			await this.tree.read(async (txn) => {
				const server = new Server(txn)
				await pipe(
					stream.source,
					lp.decode,
					decodeRequests,
					(reqs) => server.handle(reqs),
					encodeResponses,
					lp.encode,
					stream.sink
				)
			})

			this.log("closed incoming stream %s from peer %p", stream.id, connection.remotePeer)
		} catch (err) {
			this.log.error("aborting incoming stream %s from peer %p: %O", stream.id, connection.remotePeer, err)
			if (err instanceof Error) {
				stream.abort(err)
			} else {
				stream.abort(new Error("internal error"))
			}
		}
	}

	private handleConnect = async (connection: Connection) => {
		this.log("new connection to peer %p", connection.remotePeer)
		this.sync(connection)
	}

	private async sync(connection: Connection) {
		this.log("initiating sync with peer %p", connection.id, connection.remotePeer)

		let stream: Stream | null = null
		try {
			stream = await connection.newStream(this.protocol)
			this.log("opened outgoing stream %s to peer %p", stream.id, connection.remotePeer)
		} catch (err) {
			const { id, remotePeer } = connection
			this.log.error("failed to open outgoing stream: %O", id, remotePeer, err)
			return
		}

		const client = new Client(stream)

		try {
			await this.tree.write(async (txn) => {
				this.log("opened read-write transaction")
				const driver = new Driver(client, txn)
				for await (const [key, value] of driver.sync()) {
					this.log("got entry %s: %s", hex(key), hex(value))
					try {
						await this.init.apply(key, value)
					} catch (err) {
						this.log.error("failed to apply entry: %O", err)
						continue
					}

					await txn.set(key, value)
				}

				this.log("committing transaction")
			})
		} catch (err) {
			this.log.error("sync failed: %O", err)
		} finally {
			client.end()
			stream.close()
			this.log("closed outgoing stream %s to peer %p", stream.id, connection.remotePeer)
		}
	}
}
