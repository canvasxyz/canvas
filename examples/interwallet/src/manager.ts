import { bytesToHex, hexToBytes } from "viem"
import { blake3 } from "@noble/hashes/blake3"
import { logger } from "@libp2p/logger"

import { Libp2p } from "@libp2p/interface-libp2p"
import { PubSub } from "@libp2p/interface-pubsub"
import { encode, decode } from "microcbor"
import { equals } from "uint8arrays"
import { base58btc } from "multiformats/bases/base58"

import { Store } from "@canvas-js/store/browser"

import Messages from "#protocols/messages"

import { PrivateUserRegistration, PublicUserRegistration } from "./interfaces"
import { ROOM_REGISTRY_TOPIC, USER_REGISTRY_TOPIC } from "./constants"
import { encryptData, decryptData, signData, verifyData, assert, verifyKeyBundle } from "./cryptography"
import { db } from "./db"

type EventMap = {
	message: { content: string; timestamp: number }
}

type RoomEvent = { [Type in keyof EventMap]: { room: string; type: Type; detail: EventMap[Type] } }[keyof EventMap]

export class RoomManager {
	public static async initialize(
		libp2p: Libp2p<{ pubsub: PubSub }>,
		user: PrivateUserRegistration
	): Promise<RoomManager> {
		const manager = new RoomManager(libp2p, user)

		manager.roomRegistry = await Store.open(libp2p, {
			topic: ROOM_REGISTRY_TOPIC,
			apply: manager.applyRoomRegistryEntry,
		})

		manager.userRegistry = await Store.open(libp2p, {
			topic: USER_REGISTRY_TOPIC,
			apply: manager.applyUserRegistryEntry,
		})

		return manager
	}

	private readonly rooms = new Map<string, { store: Store; members: PublicUserRegistration[] }>()
	private userRegistry: Store | null = null
	private roomRegistry: Store | null = null

	private readonly log = logger("canvas:interwallet:manager")

	private constructor(
		private readonly libp2p: Libp2p<{ pubsub: PubSub }>,
		private readonly user: PrivateUserRegistration
	) {}

	public async start() {
		if (this.userRegistry === null || this.roomRegistry === null) {
			throw new Error("tried to start uninitialized manager")
		}

		this.log("starting manager")

		await this.roomRegistry.start()
		await this.userRegistry.start()

		const rooms = await db.rooms.toArray()
		await Promise.all(rooms.map(({ id, members }) => this.addRoom(id, members)))

		const key = hexToBytes(this.user.address)
		const existingRegistration = await this.userRegistry.get(key)
		if (existingRegistration === null) {
			this.log("publishing self user registration")

			const value = Messages.SignedUserRegistration.encode({
				address: hexToBytes(this.user.address),
				signature: hexToBytes(this.user.keyBundleSignature),
				keyBundle: {
					signingAddress: hexToBytes(this.user.keyBundle.signingAddress),
					encryptionPublicKey: hexToBytes(this.user.keyBundle.encryptionPublicKey),
				},
			}).finish()

			await this.userRegistry.insert(key, value)
		}
	}

	public async stop() {
		await this.userRegistry?.stop()
		await this.roomRegistry?.stop()
		await Promise.all([...this.rooms.values()].map(({ store }) => store.stop()))
		this.rooms.clear()
	}

	public async createRoom(members: PublicUserRegistration[]): Promise<{ roomId: string }> {
		this.log("creating new room")
		assert(this.roomRegistry !== null, "manager is still initializing")
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
			members: members.map((member) => ({
				address: hexToBytes(member.address),
				signature: hexToBytes(member.keyBundleSignature),
				keyBundle: {
					signingAddress: hexToBytes(member.keyBundle.signingAddress),
					encryptionPublicKey: hexToBytes(member.keyBundle.encryptionPublicKey),
				},
			})),
		}).finish()

		const signedRoomRegistration = signData(roomRegistration, this.user)
		const value = Messages.SignedData.encode(signedRoomRegistration).finish()

		await this.roomRegistry.insert(key, value)

		const roomId = base58btc.baseEncode(key)
		return { roomId }
	}

	public async dispatchEvent(event: RoomEvent): Promise<void> {
		this.log("dispatching room event")

		const room = this.rooms.get(event.room)
		assert(room !== undefined, `room with topic ${event.room} not found`)

		const recipient = room.members.find(({ address }) => this.user.address !== address)
		assert(recipient !== undefined, "room has no other members")

		const signedData = Messages.SignedData.encode(signData(encode(event), this.user)).finish()
		const encryptedData = Messages.EncryptedData.encode(encryptData(signedData, recipient)).finish()
		const key = blake3(encryptedData, { dkLen: 16 })
		await room.store.insert(key, encryptedData)
	}

	private applyEventEntry =
		(roomId: string, members: PublicUserRegistration[]) => async (key: Uint8Array, value: Uint8Array) => {
			console.log({ key: bytesToHex(key), value: bytesToHex(value) })

			assert(equals(key, blake3(value, { dkLen: 16 })), "invalid event: key is not hash of value")

			const encryptedData = Messages.EncryptedData.decode(value)
			const decryptedData = decryptData(encryptedData, this.user)
			const signedData = Messages.SignedData.decode(decryptedData)
			const senderSigningAddress = hexToBytes(verifyData(signedData))

			const sender = members.find(({ keyBundle: { signingAddress } }) =>
				equals(senderSigningAddress, hexToBytes(signingAddress))
			)

			assert(sender !== undefined, "event not signed by a room member")

			const event = decode(signedData.payload) as RoomEvent
			assert(event.room === roomId, "invalid event: wrong topic")

			// TODO: runtime validation of room event types
			if (event.type === "message") {
				const id = await db.messages.add({ room: roomId, sender: sender.address, ...event.detail })
				console.log("added message with id", id)
			} else {
				throw new Error("invalid event type")
			}
		}

	private applyRoomRegistryEntry = async (key: Uint8Array, value: Uint8Array) => {
		console.log(`${ROOM_REGISTRY_TOPIC}: got entry`, { key: bytesToHex(key), value: bytesToHex(value) })

		const signedData = Messages.SignedData.decode(value)
		const creatorSigningAddress = hexToBytes(verifyData(signedData))

		const roomRegistration = Messages.RoomRegistration.decode(signedData.payload)
		const hash = blake3.create({ dkLen: 16 })
		for (const member of roomRegistration.members) {
			assert(member.address, "missing member.address")
			hash.update(member.address)
		}

		assert(equals(key, hash.digest()), "invalid room registration key")

		assert(roomRegistration.members.length === 2, "rooms must have exactly two members")

		const members = roomRegistration.members.map(Messages.SignedUserRegistration.create).map(verifyKeyBundle)
		const creator = members.find(({ keyBundle }) => equals(creatorSigningAddress, hexToBytes(keyBundle.signingAddress)))
		assert(creator !== undefined, "invalid room registration signature")
		assert(equals(hexToBytes(creator.address), roomRegistration.creator), "invalid room registration signature")

		// if the current user is a member of the room
		if (members.find(({ address }) => equals(hexToBytes(address), hexToBytes(this.user.address)))) {
			const roomId = base58btc.baseEncode(key)

			this.log(
				"adding room %s with members %o",
				roomId,
				members.map(({ address }) => address)
			)

			await db.rooms.add({ id: roomId, creator: creator.address, members })

			const store = await Store.open(this.libp2p, {
				topic: `interwallet:room:${roomId}`,
				apply: this.applyEventEntry(roomId, members),
			})

			if (this.libp2p.isStarted()) {
				await store.start()
			}

			this.rooms.set(roomId, { store, members })
		}
	}

	private applyUserRegistryEntry = async (key: Uint8Array, value: Uint8Array) => {
		console.log(`${USER_REGISTRY_TOPIC}: got entry`, { key: bytesToHex(key), value: bytesToHex(value) })

		const signedUserRegistration = Messages.SignedUserRegistration.decode(value)
		const userRegistration = verifyKeyBundle(signedUserRegistration)
		await db.users.add(userRegistration)
	}

	private async addRoom(roomId: string, members: PublicUserRegistration[]): Promise<void> {
		assert(members.length === 2, "rooms must have exactly two members")
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
