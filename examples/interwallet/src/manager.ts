import { bytesToHex, getAddress, hexToBytes } from "viem"
import { blake3 } from "@noble/hashes/blake3"
import { logger } from "@libp2p/logger"

import { Libp2p } from "@libp2p/interface-libp2p"
import { PubSub } from "@libp2p/interface-pubsub"
import { PeerId } from "@libp2p/interface-peer-id"

import { encode, decode } from "microcbor"
import { equals } from "uint8arrays"
import { base58btc } from "multiformats/bases/base58"

import nacl from "tweetnacl"

import { Store } from "@canvas-js/store/browser"

import * as Messages from "./protocols/messages"

import { PrivateUserRegistration, PublicUserRegistration } from "./interfaces"
import { ROOM_REGISTRY_TOPIC, USER_REGISTRY_TOPIC } from "./constants"
import { signData, verifyData, assert, verifyKeyBundle } from "./cryptography"
import { Room, db } from "./db"
import { getLibp2p } from "./libp2p"

type EventMap = {
	message: { content: string; timestamp: number; sender: string }
}

type RoomEvent = { [Type in keyof EventMap]: { room: string; type: Type; detail: EventMap[Type] } }[keyof EventMap]

export class RoomManager {
	public static async initialize(peerId: PeerId, user: PrivateUserRegistration): Promise<RoomManager> {
		const libp2p = await getLibp2p(peerId)

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
		public readonly libp2p: Libp2p<{ pubsub: PubSub }>,
		public readonly user: PrivateUserRegistration
	) {}

	public isStarted() {
		return this.libp2p.isStarted()
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
			})

			await this.userRegistry.insert(key, value)
		}
	}

	public async stop() {
		await this.userRegistry?.stop()
		await this.roomRegistry?.stop()
		await Promise.all([...this.rooms.values()].map(({ store }) => store.stop()))

		await this.libp2p.stop()
	}

	public async createRoom(members: PublicUserRegistration[]): Promise<Room> {
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
		})

		const signedRoomRegistration = signData(roomRegistration, this.user)
		const value = Messages.SignedData.encode(signedRoomRegistration)

		await this.roomRegistry.insert(key, value)

		const roomId = base58btc.baseEncode(key)
		return { id: roomId, creator: this.user.address, members }
	}

	public async dispatchEvent(event: RoomEvent): Promise<void> {
		this.log("dispatching room event")

		const room = this.rooms.get(event.room)
		assert(room !== undefined, `room with topic ${event.room} not found`)

		const recipient = room.members.find(({ address }) => this.user.address !== address)
		assert(recipient !== undefined, "room has no other members")

		const nonce = nacl.randomBytes(nacl.box.nonceLength)
		const ciphertext = nacl.box(
			encode(event),
			nonce,
			hexToBytes(recipient.keyBundle.encryptionPublicKey),
			hexToBytes(this.user.privateKey)
		)

		const encryptedData = Messages.EncryptedData.encode({ ciphertext, nonce })

		const key = blake3(encryptedData, { dkLen: 16 })
		await room.store.insert(key, encryptedData)
	}

	private applyEventEntry =
		(roomId: string, members: PublicUserRegistration[]) => async (key: Uint8Array, value: Uint8Array) => {
			console.log({ key: bytesToHex(key), value: bytesToHex(value) })

			assert(equals(key, blake3(value, { dkLen: 16 })), "invalid event: key is not hash of value")

			// details of the other user (if we are the sender, then it is the recipient, vice versa)
			const otherPublicUserRegistration = members.find(({ address }) => getAddress(address) !== this.user.address)
			if (otherPublicUserRegistration === undefined) {
				throw new Error("event is not for this user")
			}

			const encryptedData = Messages.EncryptedData.decode(value)

			const decryptedData = nacl.box.open(
				encryptedData.ciphertext,
				encryptedData.nonce,
				hexToBytes(otherPublicUserRegistration.keyBundle.encryptionPublicKey),
				hexToBytes(this.user.privateKey)
			)

			if (decryptedData === null) {
				throw new Error("failed to decrypt event")
			}

			const event = decode(decryptedData) as RoomEvent

			assert(event.room === roomId, "invalid event: wrong topic")

			// TODO: runtime validation of room event types
			if (event.type === "message") {
				const id = await db.messages.add({ room: roomId, ...event.detail })
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

		const members = roomRegistration.members.map(verifyKeyBundle)
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

			await this.addRoom(roomId, members)
		}
	}

	private applyUserRegistryEntry = async (key: Uint8Array, value: Uint8Array) => {
		console.log(`${USER_REGISTRY_TOPIC}: got entry`, { key: bytesToHex(key), value: bytesToHex(value) })

		const signedUserRegistration = Messages.SignedUserRegistration.decode(value)
		const userRegistration = verifyKeyBundle(signedUserRegistration)
		await db.users.add(userRegistration)
	}

	private async addRoom(roomId: string, members: PublicUserRegistration[]): Promise<void> {
		const store = await Store.open(this.libp2p, {
			topic: `interwallet:room:${roomId}`,
			apply: this.applyEventEntry(roomId, members),
		})

		if (this.libp2p.isStarted()) {
			await store.start()
		}

		this.rooms.set(roomId, { store, members })
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
