import {
	PeerId,
	Startable,
	Logger,
	TypedEventTarget,
	Libp2pEvents,
	PeerStore,
	Connection,
	Stream,
	StreamHandler,
} from "@libp2p/interface"
import { Registrar, AddressManager, ConnectionManager } from "@libp2p/interface-internal"
import { logger } from "@libp2p/logger"

import * as lp from "it-length-prefixed"
import { pipe } from "it-pipe"

import { assert } from "@canvas-js/utils"

import { Message, decodeMessages, encodeMessages } from "@canvas-js/libp2p-rendezvous/protocol"

import { RegistrationStore } from "./RegistrationStore.js"

export type RendezvousServerComponents = {
	events: TypedEventTarget<Libp2pEvents>
	peerId: PeerId
	peerStore: PeerStore
	registrar: Registrar
	addressManager: AddressManager
	connectionmanager: ConnectionManager
}

export interface RendezvousServerInit {}

export class RendezvousServer implements Startable {
	public static protocol = "/canvas/rendezvous/1.0.0"
	public static maxTTL = BigInt(72 * 60 * 60) // 72h
	public static defaultTTL = BigInt(2 * 60 * 60) // 2h

	private readonly log: Logger
	private readonly store = new RegistrationStore()

	#started: boolean = false

	constructor(private readonly components: RendezvousServerComponents, init: RendezvousServerInit) {
		this.log = logger(`canvas:rendezvous`)
	}

	public isStarted() {
		return this.#started
	}

	public async beforeStart() {
		this.log("beforeStart")
		await this.components.registrar.handle(RendezvousServer.protocol, this.handleIncomingStream)
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
		await this.components.registrar.unhandle(RendezvousServer.protocol)
	}

	public async stop() {
		this.log("stop")
		this.store.close()
		this.#started = false
	}

	public afterStop(): void {}

	private handleIncomingStream: StreamHandler = ({ stream, connection }) => {
		const handle = (reqs: AsyncIterable<Message>) => this.handleMessages(connection, reqs)
		pipe(stream, lp.decode, decodeMessages, handle, encodeMessages, lp.encode, stream).catch((err) => {
			this.log.error(err)
			stream.abort(err)
		})
	}

	private async *handleMessages(connection: Connection, reqs: AsyncIterable<Message>): AsyncIterable<Message> {
		for await (const req of reqs) {
			if (req.type === Message.MessageType.REGISTER) {
				assert(req.register !== undefined, "invalid REGISTER message")
				const { ns, signedPeerRecord, ttl } = req.register
				assert(ns.length < 256, "invalid namespace")

				const valid = await this.components.peerStore.consumePeerRecord(signedPeerRecord, connection.remotePeer)
				assert(valid, "invalid peer record")
				assert(ttl <= RendezvousServer.maxTTL, "invalid ttl")

				const actualTTL = ttl === 0n ? RendezvousServer.defaultTTL : ttl

				this.store.register(connection.remotePeer, ns, signedPeerRecord, Number(actualTTL))

				yield {
					type: Message.MessageType.REGISTER_RESPONSE,
					registerResponse: { status: Message.ResponseStatus.OK, statusText: "OK", ttl: actualTTL },
				}
			} else if (req.type === Message.MessageType.UNREGISTER) {
				assert(req.unregister !== undefined, "invalid UNREGISTER message")
				const { ns } = req.unregister
				assert(ns.length < 256, "invalid namespace")

				this.store.unregister(connection.remotePeer, ns)
			} else if (req.type === Message.MessageType.DISCOVER) {
				assert(req.discover !== undefined, "invalid DISCOVER message")
				const { ns, limit, cookie } = req.discover
				assert(ns.length < 256, "invalid namespace")
				assert(limit < BigInt(Number.MAX_SAFE_INTEGER), "invalid limit")
				const registrations = this.discover(ns, Number(limit), cookie)
				yield {
					type: Message.MessageType.DISCOVER_RESPONSE,
					discoverResponse: {
						status: Message.ResponseStatus.OK,
						statusText: "OK",
						registrations,
						cookie: new Uint8Array([]),
					},
				}
			} else {
				throw new Error("invalid request message type")
			}
		}
	}

	private discover(namespace: string, limit: number, cookie: Uint8Array): Message.Register[] {
		return []
	}
}

export const rendezvousServer =
	(init: RendezvousServerInit = {}) =>
	(components: RendezvousServerComponents) =>
		new RendezvousServer(components, init)
