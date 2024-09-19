import {
	PeerId,
	Startable,
	Logger,
	TypedEventTarget,
	Libp2pEvents,
	PeerStore,
	Libp2p,
	Connection,
	StreamHandler,
} from "@libp2p/interface"
import { Registrar, AddressManager, ConnectionManager } from "@libp2p/interface-internal"
import { logger } from "@libp2p/logger"

import * as lp from "it-length-prefixed"
import { pipe } from "it-pipe"

import { assert } from "@canvas-js/utils"
import { multiaddr, Multiaddr } from "@multiformats/multiaddr"

import { Message, decodeMessages, encodeMessages } from "@canvas-js/libp2p-rendezvous/protocol"

export type RendezvousServiceComponents = {
	events: TypedEventTarget<Libp2pEvents>
	peerId: PeerId
	peerStore: PeerStore
	registrar: Registrar
	addressManager: AddressManager
	connectionManager: ConnectionManager
}

export interface RendezvousServiceInit {
	server: string | Multiaddr
}

export class RendezvousService implements Startable {
	public static protocol = "/canvas/rendezvous/1.0.0"
	public static maxTTL = BigInt(72 * 60 * 60) // 72h
	public static defaultTTL = BigInt(2 * 60 * 60) // 2h

	private readonly log = logger(`canvas:rendezvous:client`)
	private readonly server: Multiaddr
	#started: boolean = false

	constructor(private readonly components: RendezvousServiceComponents, { server }: RendezvousServiceInit) {
		this.server = typeof server === "string" ? multiaddr(server) : server
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

		try {
			const connection = await this.components.connectionManager.openConnection(this.server)
		} catch (err) {
			// ...
		}
	}

	public async beforeStop() {
		this.log("beforeStop")
	}

	public async stop() {
		this.log("stop")
		this.#started = false
	}

	public afterStop(): void {}

	public async register(namespace: string, ttl?: number) {}

	public async unregister(namespace: string) {}

	public async discover(namespace: string, limit: number, cookie?: Uint8Array): Promise<Message.Register[]> {
		return []
	}
}

export const rendezvous = (init: RendezvousServiceInit) => (components: RendezvousServiceComponents) =>
	new RendezvousService(components, init)

export async function discover(libp2p: Libp2p<{}>): Promise<void> {
	//
}
