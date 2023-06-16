import { getAddress, bytesToHex, hexToBytes } from "viem"
import { blake3 } from "@noble/hashes/blake3"
import { logger } from "@libp2p/logger"

import type { Libp2p } from "@libp2p/interface-libp2p"
import type { PubSub } from "@libp2p/interface-pubsub"
import type { PeerId } from "@libp2p/interface-peer-id"

import { encode, decode } from "microcbor"
import { base58btc } from "multiformats/bases/base58"

import nacl from "tweetnacl"

import { Store } from "@canvas-js/store"
import { openStore } from "@canvas-js/store/browser"

import * as Messages from "../shared/messages.js"
import {
	PrivateUserRegistration,
	PublicUserRegistration,
	ROOM_REGISTRY_TOPIC,
	USER_REGISTRY_TOPIC,
	assert,
	Room,
	validateRoomRegistration,
	validateUserRegistration,
	validateEvent,
} from "../shared/index.js"

import { db } from "./db.js"
import { getLibp2p } from "./libp2p.js"
import { equals } from "uint8arrays"
import Dexie from "dexie"

type EventMap = {
	message: { content: string; timestamp: number; sender: string }
}

type RoomEvent = { [Type in keyof EventMap]: { type: Type; detail: EventMap[Type] } }[keyof EventMap]

const serializePublicUserRegistration = (user: PublicUserRegistration): Messages.SignedUserRegistration => ({
	address: hexToBytes(user.address),
	signature: hexToBytes(user.keyBundleSignature),
	keyBundle: {
		signingPublicKey: hexToBytes(user.keyBundle.signingPublicKey),
		encryptionPublicKey: hexToBytes(user.keyBundle.encryptionPublicKey),
	},
})

export class RoomManager {
	public static async initialize(peerId: PeerId, user: PrivateUserRegistration): Promise<RoomManager> {
		const libp2p = await getLibp2p(peerId)

		const manager = new RoomManager(libp2p, user)

		manager.roomRegistry = await openStore(libp2p, {
			topic: ROOM_REGISTRY_TOPIC,
			apply: manager.applyRoomRegistryEntry,
		})

		manager.userRegistry = await openStore(libp2p, {
			topic: USER_REGISTRY_TOPIC,
			apply: manager.applyUserRegistryEntry,
		})

		await manager.start()

		return manager
	}

	private readonly rooms = new Map<string, { store: Store; members: PublicUserRegistration[] }>()
	private userRegistry: Store | null = null
	private roomRegistry: Store | null = null
	#started = false

	private readonly log = logger("canvas:interwallet:manager")

	private constructor(
		public readonly libp2p: Libp2p<{ pubsub: PubSub }>,
		public readonly user: PrivateUserRegistration
	) {}

	public isStarted() {
		return this.#started
	}

	public async start() {
		if (this.userRegistry === null || this.roomRegistry === null) {
			throw new Error("tried to start uninitialized manager")
		} else if (this.libp2p.isStarted()) {
			return
		}

		this.log("starting manager")

		await this.libp2p.start()

		await this.roomRegistry.start()
		await this.userRegistry.start()

		const rooms = await db.rooms.toArray()
		await Promise.all(rooms.map((room) => this.addRoom(room)))

		const key = hexToBytes(this.user.address)
		const existingRegistration = await this.userRegistry.get(key)
		if (existingRegistration === null) {
			this.log("publishing self user registration")

			const value = Messages.SignedUserRegistration.encode(serializePublicUserRegistration(this.user))

			await this.userRegistry.insert(key, value)
		}

		this.#started = true
	}

	public async stop() {
		await this.userRegistry?.stop()
		await this.roomRegistry?.stop()
		await Promise.all([...this.rooms.values()].map(({ store }) => store.stop()))

		await this.libp2p.stop()
		this.#started = false
	}

	public async destroyTables() {
		await Dexie.delete(USER_REGISTRY_TOPIC)
		this.userRegistry = null

		await Dexie.delete(ROOM_REGISTRY_TOPIC)
		this.roomRegistry = null

		for (const roomTopic of this.rooms.keys()) {
			await Dexie.delete(`interwallet:room:${roomTopic}`)
			this.rooms.delete(roomTopic)
		}
	}
}
