import {
	PeerId,
	Startable,
	TypedEventTarget,
	Libp2pEvents,
	PeerStore,
	CodeError,
	Peer,
	Connection,
	peerDiscoverySymbol,
	serviceCapabilities,
	TypedEventEmitter,
	PeerDiscoveryEvents,
} from "@libp2p/interface"
import { Registrar, AddressManager, ConnectionManager } from "@libp2p/interface-internal"
import { logger } from "@libp2p/logger"
import { PeerRecord, RecordEnvelope } from "@libp2p/peer-record"
import { Multiaddr } from "@multiformats/multiaddr"

import * as lp from "it-length-prefixed"
import { pipe } from "it-pipe"
import { pushable } from "it-pushable"

import { Message, decodeMessages, encodeMessages } from "@canvas-js/libp2p-rendezvous/protocol"
import { assert } from "./utils.js"

export interface RendezvousPoint {
	discover(namespace: string, options?: { limit?: number }): Promise<Peer[]>
	register(namespace: string, options?: { ttl?: number }): Promise<{ ttl: number }>
	unregister(namespace: string): Promise<void>
}

export type RendezvousClientComponents = {
	events: TypedEventTarget<Libp2pEvents>
	peerId: PeerId
	peerStore: PeerStore
	registrar: Registrar
	addressManager: AddressManager
	connectionManager: ConnectionManager
}

export interface RendezvousClientInit {
	/**
	 * namespace or array of namespaces to register automatically
	 * with all peers that support the rendezvous server protocol
	 */
	autoRegister?: string[] | null
	autoDiscover?: boolean
	connectionFilter?: (connection: Connection) => boolean
}

export class RendezvousClient extends TypedEventEmitter<PeerDiscoveryEvents> implements Startable {
	public static protocol = "/canvas/rendezvous/1.0.0"

	private readonly log = logger("canvas:rendezvous:client")
	private readonly serverPeers = new Map<string, PeerId>()
	private readonly registerIntervals = new Map<string, NodeJS.Timeout>()

	private readonly autoRegister: string[]
	private readonly autoDiscover: boolean
	private readonly connectionFilter: (connection: Connection) => boolean

	#started: boolean = false
	#topologyId: string | null = null

	constructor(private readonly components: RendezvousClientComponents, init: RendezvousClientInit) {
		super()
		this.autoRegister = init.autoRegister ?? []
		this.autoDiscover = init.autoDiscover ?? true
		this.connectionFilter = init.connectionFilter ?? ((connection) => true)
	}

	readonly [peerDiscoverySymbol] = this;

	readonly [serviceCapabilities]: string[] = ["@libp2p/peer-discovery"]

	public isStarted() {
		return this.#started
	}

	public async beforeStart() {
		this.log("beforeStart")

		this.#topologyId = await this.components.registrar.register(RendezvousClient.protocol, {
			onConnect: (peerId, connection) => {
				if (this.connectionFilter(connection)) {
					this.serverPeers.set(peerId.toString(), peerId)
					this.#register(connection)
				}
			},
			onDisconnect: (peerId) => {
				this.serverPeers.delete(peerId.toString())
			},
		})
	}

	public async start() {
		this.log("start")
		this.#started = true
	}

	public async afterStart() {
		this.log("afterStart")
	}

	public async beforeStop() {
		this.log("beforeStop")
		if (this.#topologyId !== null) {
			this.components.registrar.unregister(this.#topologyId)
		}

		for (const intervalId of this.registerIntervals.values()) {
			clearInterval(intervalId)
		}

		this.registerIntervals.clear()
	}

	public async stop() {
		this.log("stop")
		this.#started = false
	}

	public afterStop(): void {}

	async #register(connection: Connection) {
		const peerId = connection.remotePeer

		if (this.autoRegister.length === 0) {
			return
		}

		const minTTL = await this.#connect(connection, async (point) => {
			let minTTL = Infinity

			for (const ns of this.autoRegister) {
				const { ttl } = await point.register(ns)
				minTTL = Math.min(minTTL, ttl)

				this.log("successfully registered %s with %p (ttl %d)", ns, peerId, ttl)

				if (this.autoDiscover) {
					const results = await point.discover(ns)
					for (const peerData of results) {
						if (peerData.id.equals(this.components.peerId)) {
							continue
						}

						await this.components.peerStore.merge(peerData.id, peerData)
						this.safeDispatchEvent("peer", { detail: peerData })
					}
				}
			}

			return minTTL
		})

		if (minTTL === Infinity) {
			return
		}

		clearInterval(this.registerIntervals.get(peerId.toString()))
		this.registerIntervals.set(
			peerId.toString(),
			setTimeout(() => {
				this.registerIntervals.delete(peerId.toString())

				this.log("refreshing registration with %p", peerId)
				this.components.connectionManager.openConnection(peerId).then(
					(connection) => this.#register(connection),
					(err) => this.log.error("failed to open connection to peer %p: %O", peerId, err),
				)
			}, minTTL * 1000),
		)
	}

	public async connect<T>(
		server: PeerId | Multiaddr | Multiaddr[],
		callback: (point: RendezvousPoint) => T | Promise<T>,
	): Promise<T> {
		assert(this.#started, "service not started")

		const connection = await this.components.connectionManager.openConnection(server)
		this.log("got connection %s to peer %p", connection.id, connection.remotePeer)

		return await this.#connect(connection, callback)
	}

	async #connect<T>(connection: Connection, callback: (point: RendezvousPoint) => T | Promise<T>): Promise<T> {
		const stream = await connection.newStream(RendezvousClient.protocol)
		this.log("opened outgoing rendezvous stream %s", stream.id)

		const source = pushable<Message>({ objectMode: true })
		pipe(source, encodeMessages, lp.encode, stream.sink).catch((err) => {
			this.log.error("error piping requests: %O", err)
			stream.abort(err)
		})

		const sink = pipe(stream.source, lp.decode, decodeMessages)

		try {
			return await callback({
				discover: async (namespace, options = {}) => {
					this.log.trace("discover(%s, %o)", namespace, options)
					source.push({
						type: Message.MessageType.DISCOVER,
						discover: { ns: namespace, limit: BigInt(options.limit ?? 0), cookie: new Uint8Array() },
					})

					const { done, value: res } = await sink.next()
					assert(!done, "stream ended prematurely")

					assert(res.type === Message.MessageType.DISCOVER_RESPONSE, "expected DISCOVER_RESPONSE message")
					assert(res.discoverResponse !== undefined, "invalid DISCOVER_RESPONSE message")

					const { status, statusText, registrations, cookie } = res.discoverResponse
					if (status !== Message.ResponseStatus.OK) {
						throw new CodeError(`error in discovery response: ${statusText}`, status)
					}

					const peers: Peer[] = []

					for (const { ns, signedPeerRecord } of registrations) {
						assert(ns === namespace, "invalid namespace in registration")
						const envelope = await RecordEnvelope.openAndCertify(signedPeerRecord, PeerRecord.DOMAIN)
						const { peerId, multiaddrs } = PeerRecord.createFromProtobuf(envelope.payload)
						assert(envelope.peerId.equals(peerId), "invalid peer id in registration")

						const peer = await this.components.peerStore.merge(peerId, {
							addresses: multiaddrs.map((addr) => ({ multiaddr: addr, isCertified: true })),
							peerRecordEnvelope: signedPeerRecord,
						})

						peers.push(peer)
					}

					return peers
				},
				register: async (namespace, options = {}) => {
					this.log.trace("register(%s, %o)", namespace, options)
					const multiaddrs = this.components.addressManager.getAnnounceAddrs()
					const record = new PeerRecord({ peerId: this.components.peerId, multiaddrs })
					const envelope = await RecordEnvelope.seal(record, this.components.peerId)
					const signedPeerRecord = envelope.marshal()

					source.push({
						type: Message.MessageType.REGISTER,
						register: { ns: namespace, signedPeerRecord, ttl: BigInt(options.ttl ?? 0) },
					})

					const { done, value: res } = await sink.next()

					assert(!done, "stream ended prematurely")
					assert(res.type === Message.MessageType.REGISTER_RESPONSE, "expected REGISTER_RESPONSE message")
					assert(res.registerResponse !== undefined, "invalid REGISTER_RESPONSE message")

					const { status, statusText, ttl } = res.registerResponse
					if (status !== Message.ResponseStatus.OK) {
						throw new CodeError(`error in register response: ${statusText}`, status)
					}

					return { ttl: Number(ttl) }
				},
				unregister: async (namespace) => {
					this.log.trace("unregister(%s)", namespace)
					source.push({
						type: Message.MessageType.UNREGISTER,
						unregister: { ns: namespace },
					})
				},
			})
		} finally {
			source.end()
			stream.close()
			this.log("closed outgoing rendezvous stream %s", stream.id)
		}
	}
}

export const rendezvousClient =
	(init: RendezvousClientInit = {}) =>
	(components: RendezvousClientComponents) =>
		new RendezvousClient(components, init)
