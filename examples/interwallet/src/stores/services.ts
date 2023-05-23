import { bytesToHex } from "viem"
import { blake3 } from "@noble/hashes/blake3"

import { encode, decode } from "microcbor"
import { equals } from "uint8arrays"

import { IDBTree } from "@canvas-js/okra-idb"

import { storeService, StoreService, StoreComponents } from "@canvas-js/store/service/browser"

import Events from "#protocols/events"

import { EventMap, PublicUserRegistration, Room } from "../interfaces"
import { rooms } from "../fixtures"
import { storeDB } from "./storeDB"
import { modelDB } from "../models/modelDB"
import { ROOM_REGISTRY_TOPIC, USER_REGISTRY_TOPIC } from "../constants"

export async function getRoomRegistryService(): Promise<(components: StoreComponents) => StoreService> {
	const tree = await IDBTree.open(storeDB, ROOM_REGISTRY_TOPIC)
	return storeService(tree, {
		topic: ROOM_REGISTRY_TOPIC,
		apply: async (key, value) => {
			console.log(`${ROOM_REGISTRY_TOPIC}: got entry`, { key: bytesToHex(key), value: bytesToHex(value) })
			const room = Events.Room.decode(value)
			const roomModel: Room = {
				creator: room.creator as `0x${string}`,
				topic: room.topic as `interwallet:room:${string}`,
				members: room.members as [`0x${string}`, `0x${string}`],
			}
			await modelDB.rooms.put(roomModel)
		},
	})
}

export async function getUserRegistryService(): Promise<(components: StoreComponents) => StoreService> {
	const tree = await IDBTree.open(storeDB, USER_REGISTRY_TOPIC)
	return storeService(tree, {
		topic: USER_REGISTRY_TOPIC,
		apply: async (key, value) => {
			console.log(`${USER_REGISTRY_TOPIC}: applying entry`, { key: bytesToHex(key), value: bytesToHex(value) })
			// deserialize signed key bundle
			const signedKeyBundle = Events.SignedKeyBundle.decode(value)
			// this could be its own function
			const publicUserRegistration: PublicUserRegistration = {
				address: bytesToHex(key),
				keyBundle: {
					encryptionPublicKey: bytesToHex(signedKeyBundle.encryptionPublicKey),
					signingAddress: bytesToHex(signedKeyBundle.signingAddress),
				},
			}
			await modelDB.users.put(publicUserRegistration)
		},
	})
}

export type RoomEvent = { [Type in keyof EventMap]: { type: Type; detail: EventMap[Type] } }[keyof EventMap]

export function encodeRoomEvent<Type extends keyof EventMap>(type: Type, detail: EventMap[Type]): Uint8Array {
	return encode({ type, detail })
}

export async function getRoomStoreServices(): Promise<Record<string, (components: StoreComponents) => StoreService>> {
	const roomStoreServices: Record<string, (components: StoreComponents) => StoreService> = {}

	for (const { topic } of rooms) {
		const tree = await IDBTree.open(storeDB, topic)
		roomStoreServices[topic] = storeService(tree, {
			topic,
			apply: async (key, value) => {
				console.log({ key: bytesToHex(key), value: bytesToHex(value) })
				if (!equals(key, blake3(value, { dkLen: 16 }))) {
					throw new Error("invalid event: key is not hash of value")
				}

				const event = decode(value) as RoomEvent
				if (event.type === "message") {
					const id = await modelDB.messages.put(event.detail)
					console.log("added message with id", id)
				} else {
					throw new Error("invalid event: invalid event type")
				}
			},
		})
	}

	return roomStoreServices
}
