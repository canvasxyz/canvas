import {
	PeerId,
	Startable,
	TypedEventTarget,
	Libp2pEvents,
	PeerStore,
	Libp2p,
	CodeError,
	Peer,
} from "@libp2p/interface"
import { Registrar, AddressManager, ConnectionManager } from "@libp2p/interface-internal"
import { logger } from "@libp2p/logger"
import { PeerRecord, RecordEnvelope } from "@libp2p/peer-record"
import { Multiaddr } from "@multiformats/multiaddr"

import * as lp from "it-length-prefixed"
import { pipe } from "it-pipe"
import { Pushable, pushable } from "it-pushable"

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
	// servers: string[]
}

export class RendezvousClient implements Startable {
	public static protocol = "/canvas/rendezvous/1.0.0"

	// public readonly servers: Multiaddr[]
	// public readonly namespaces = new Set<string>()

	private readonly log = logger(`canvas:rendezvous:client`)

	#started: boolean = false

	constructor(private readonly components: RendezvousClientComponents, init: RendezvousClientInit) {
		// this.servers = init.servers.map(multiaddr)
	}

	public isStarted() {
		return this.#started
	}

	public async beforeStart() {
		this.log("beforeStart")
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
	}

	public async stop() {
		this.log("stop")
		this.#started = false
	}

	public afterStop(): void {}

	// public async register(ns: string | string[], options?: { ttl?: number }) {
	// 	const namespaces = typeof ns === "string" ? [ns] : ns
	// 	for (const namespace of namespaces) {
	// 		this.namespaces.delete(namespace)
	// 	}
	// }

	// public async unregister(ns: string | string[]) {
	// 	const namespaces = typeof ns === "string" ? [ns] : ns
	// 	for (const namespace of namespaces) {
	// 		this.namespaces.delete(namespace)
	// 	}
	// }

	public async connect<T>(
		server: PeerId | Multiaddr | Multiaddr[],
		callback: (point: RendezvousPoint) => T | Promise<T>,
	): Promise<T> {
		assert(this.#started, "service not started")

		const connection = await this.components.connectionManager.openConnection(server)
		this.log("got connection %s to peer %p", connection.id, connection.remotePeer)

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
					this.log("discover(%s, %o)", namespace, options)
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
					this.log("register(%s, %o)", namespace, options)
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
					this.log("unregister(%s)", namespace)
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
