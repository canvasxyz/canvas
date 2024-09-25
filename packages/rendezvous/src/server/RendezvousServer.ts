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

import { Message, decodeMessages, encodeMessages } from "@canvas-js/libp2p-rendezvous/protocol"
import { RegistrationStore } from "./RegistrationStore.js"
import { assert } from "./utils.js"

const maxTTL = BigInt(72 * 60 * 60) // 72h
const defaultTTL = BigInt(2 * 60 * 60) // 2h
const maxLimit = 64n
const defaultLimit = 16n

const clamp = (val: bigint, max: bigint) => (val > max ? max : val)

export type RendezvousServerComponents = {
	events: TypedEventTarget<Libp2pEvents>
	peerId: PeerId
	peerStore: PeerStore
	registrar: Registrar
	addressManager: AddressManager
	connectionManager: ConnectionManager
}

export interface RendezvousServerInit {
	path?: string | null
}

export class RendezvousServer implements Startable {
	public static protocol = "/canvas/rendezvous/1.0.0"

	private readonly log = logger(`canvas:rendezvous:server`)
	private readonly store: RegistrationStore

	#started: boolean = false

	constructor(private readonly components: RendezvousServerComponents, init: RendezvousServerInit) {
		this.store = new RegistrationStore(init.path ?? null)
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
		this.log("opened incoming rendezvous stream %s from peer %p", stream.id, connection.remotePeer)
		const handle = (reqs: AsyncIterable<Message>) => this.handleMessages(connection.remotePeer, reqs)
		pipe(stream, lp.decode, decodeMessages, handle, encodeMessages, lp.encode, stream).catch((err) => {
			this.log.error("error handling requests: %O", err)
			stream.abort(err)
		})
	}

	private async *handleMessages(peerId: PeerId, reqs: AsyncIterable<Message>): AsyncIterable<Message> {
		for await (const req of reqs) {
			this.log.trace("handling request: %O", req)
			if (req.type === Message.MessageType.REGISTER) {
				assert(req.register !== undefined, "invalid REGISTER message")
				const { ns, signedPeerRecord, ttl } = req.register
				assert(ns.length < 256, "invalid namespace")

				const actualTTL = ttl === 0n ? defaultTTL : clamp(ttl, maxTTL)

				await this.components.peerStore.consumePeerRecord(signedPeerRecord, peerId)

				this.store.register(ns, peerId, signedPeerRecord, actualTTL)

				const res: Message = {
					type: Message.MessageType.REGISTER_RESPONSE,
					registerResponse: { status: Message.ResponseStatus.OK, statusText: "OK", ttl: actualTTL },
				}

				this.log.trace("yielding response: %O", res)
				yield res
			} else if (req.type === Message.MessageType.UNREGISTER) {
				assert(req.unregister !== undefined, "invalid UNREGISTER message")
				const { ns } = req.unregister
				assert(ns.length < 256, "invalid namespace")

				this.store.unregister(ns, peerId)
			} else if (req.type === Message.MessageType.DISCOVER) {
				assert(req.discover !== undefined, "invalid DISCOVER message")
				const { ns, limit, cookie } = req.discover
				assert(ns.length < 256, "invalid namespace")

				const actualLimit = limit === 0n ? defaultLimit : clamp(limit, maxLimit)

				const result = this.store.discover(ns, actualLimit, cookie.byteLength === 0 ? null : cookie)

				const res: Message = {
					type: Message.MessageType.DISCOVER_RESPONSE,
					discoverResponse: {
						status: Message.ResponseStatus.OK,
						statusText: "OK",
						registrations: result.registrations,
						cookie: result.cookie,
					},
				}

				this.log.trace("yielding response: %O", res)
				yield res
			} else {
				throw new Error("invalid request message type")
			}
		}
	}
}

export const rendezvousServer =
	(init: RendezvousServerInit = {}) =>
	(components: RendezvousServerComponents) =>
		new RendezvousServer(components, init)
