import { hexToBytes } from "viem"
import { blake3 } from "@noble/hashes/blake3"
import { equals } from "uint8arrays"
import nacl from "tweetnacl"
import * as cbor from "microcbor"

import { Store } from "@canvas-js/store"
import { openStore } from "@canvas-js/store/browser"

import { libp2p } from "./libp2p.js"

import * as Messages from "../shared/messages.js"
import {
	ROOM_REGISTRY_TOPIC,
	USER_REGISTRY_TOPIC,
	PublicUserRegistration,
	RoomRegistration,
	PrivateUserRegistration,
	Room,
	RoomEvent,
	assert,
	encodeRoomRegistration,
	decodeRoomRegistration,
	decodeUserRegistration,
	encodeUserRegistration,
	encodeEncryptedEvent,
	decodeEncryptedEvent,
} from "../shared/index.js"

export const roomRegistry = await openStore<RoomRegistration, { user: PrivateUserRegistration }>(libp2p, {
	topic: ROOM_REGISTRY_TOPIC,
	encode: encodeRoomRegistration,
	decode: decodeRoomRegistration,
})

export const userRegistry = await openStore<PublicUserRegistration>(libp2p, {
	topic: USER_REGISTRY_TOPIC,
	encode: encodeUserRegistration,
	decode: decodeUserRegistration,
})

const rooms = new Map<string, Store<Messages.EncryptedEvent, { user: PrivateUserRegistration }>>()

async function addRoomEventStore(room: Room): Promise<void> {
	if (rooms.has(room.id)) {
		return
	}

	const store = await openStore<Messages.EncryptedEvent, { user: PrivateUserRegistration }>(libp2p, {
		topic: `interwallet:room:${room.id}`,
		encode: async (encryptedEvent, { user }) => {
			return encodeEncryptedEvent(encryptedEvent, { user })
		},
		decode: async (value) => {
			return await decodeEncryptedEvent(value, { room })
		},
	})

	rooms.set(room.id, store)
}

export async function createRoom(members: PublicUserRegistration[], user: PrivateUserRegistration): Promise<void> {
	assert(members.find((member) => member.address === user.address))
	roomRegistry.publish({ creator: user.address, members }, { user })
}
