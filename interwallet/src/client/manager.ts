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

import * as Messages from "#utils/messages"
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
} from "#utils"

import { db } from "./db.js"
import { getLibp2p } from "./libp2p.js"

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

	public async createRoom(members: PublicUserRegistration[]): Promise<Room> {
		this.log("creating new room")
		assert(this.roomRegistry !== null, "manager not initialized")

		assert(
			members.find(({ address }) => address === this.user.address),
			"members did not include the current user"
		)

		const hash = blake3.create({ dkLen: 16 })
		for (const { address } of members) {
			hash.update(hexToBytes(address))
		}

		const key = hash.digest()

		const roomRegistration = Messages.RoomRegistration.encode({
			creator: hexToBytes(this.user.address),
			members: members.map(serializePublicUserRegistration),
		})

		const signature = nacl.sign.detached(roomRegistration, hexToBytes(this.user.signingPrivateKey))
		const value = Messages.SignedData.encode({ signature, data: roomRegistration })

		await this.roomRegistry.insert(key, value)

		const roomId = base58btc.baseEncode(key)
		return { id: roomId, creator: this.user.address, members }
	}

	public async dispatchEvent(roomId: string, event: RoomEvent): Promise<void> {
		this.log("dispatching %s room event", event.type)

		const room = this.rooms.get(roomId)
		assert(room !== undefined, `room id ${roomId} not found`)

		const otherRoomMembers = room.members.filter(({ address }) => this.user.address !== address)
		assert(otherRoomMembers.length > 0, "room has no other members")

		const encryptedData = Messages.EncryptedEvent.encode({
			recipients: otherRoomMembers.map((otherRoomMember) => {
				const publicKey = hexToBytes(otherRoomMember.keyBundle.encryptionPublicKey)
				const nonce = nacl.randomBytes(nacl.box.nonceLength)
				const ciphertext = nacl.box(encode(event), nonce, publicKey, hexToBytes(this.user.encryptionPrivateKey))

				return {
					publicKey,
					ciphertext,
					nonce,
				}
			}),
			roomId: base58btc.baseDecode(roomId),
			userAddress: hexToBytes(this.user.address),
		})

		const signature = nacl.sign.detached(encryptedData, hexToBytes(this.user.signingPrivateKey))

		const signedData = Messages.SignedData.encode({ signature, data: encryptedData })
		const key = blake3(signedData, { dkLen: 16 })
		await room.store.insert(key, signedData)
	}

	private applyEventEntry = (room: Room) => async (key: Uint8Array, value: Uint8Array) => {
		const { encryptedEvent } = validateEvent(room, key, value)

		// details of the other user (if we are the sender, then it is the recipient, vice versa)
		const otherPublicUserRegistration = room.members.find(({ address }) => getAddress(address) !== this.user.address)
		assert(otherPublicUserRegistration !== undefined, "failed to find other room member")

		encryptedEvent.recipients.forEach(async (recipient) => {
			const decryptedEvent = nacl.box.open(
				recipient.ciphertext,
				recipient.nonce,

				hexToBytes(otherPublicUserRegistration.keyBundle.encryptionPublicKey),
				hexToBytes(this.user.encryptionPrivateKey)
			)

			assert(decryptedEvent !== null, "failed to decrypt room event")

			const event = decode(decryptedEvent) as RoomEvent

			// TODO: runtime validation of room event types
			if (event.type === "message") {
				const id = await db.messages.add({ room: room.id, ...event.detail })
				console.log("added message with id", id)
			} else {
				throw new Error("invalid event type")
			}
		})
	}

	private applyRoomRegistryEntry = async (key: Uint8Array, value: Uint8Array) => {
		const room = await validateRoomRegistration(key, value)

		// if the current user is a member of the room
		if (room.members.find(({ address }) => address === this.user.address)) {
			await db.rooms.add(room)
			await this.addRoom(room)
		}
	}

	private applyUserRegistryEntry = async (key: Uint8Array, value: Uint8Array) => {
		const userRegistration = await validateUserRegistration(key, value)
		await db.users.add(userRegistration)
	}

	private async addRoom(room: Room): Promise<void> {
		this.log(
			"adding room %s with members %o",
			room.id,
			room.members.map(({ address }) => address)
		)

		const store = await openStore(this.libp2p, {
			topic: `interwallet:room:${room.id}`,
			apply: this.applyEventEntry(room),
		})

		if (this.libp2p.isStarted()) {
			await store.start()
		}

		this.rooms.set(room.id, { store, members: room.members })
	}

	// private async removeRoom(roomId: string): Promise<void> {
	// 	const room = this.rooms.get(roomId)
	// 	if (room === undefined) {
	// 		return
	// 	}

	// 	this.rooms.delete(roomId)
	// 	await room.store.stop()
	// }
}
