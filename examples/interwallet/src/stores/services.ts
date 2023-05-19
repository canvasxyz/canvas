import { bytesToHex } from "viem"
import { blake3 } from "@noble/hashes/blake3"

import { encode, decode } from "microcbor"
import { equals } from "uint8arrays"

import { IDBTree } from "@canvas-js/okra-idb"

import { storeService, StoreService, StoreComponents } from "@canvas-js/store/service/browser"

import { rooms } from "../fixtures"
import { storeDB } from "./storeDB"
import { MessageEvent } from "../models/MessageEvent"
import { modelDB } from "../models/modelDB"

type RoomEventMap = {
	message: MessageEvent
}

type RoomEvent = { [Type in keyof RoomEventMap]: { type: Type; detail: RoomEventMap[Type] } }[keyof RoomEventMap]

export function encodeEvent<Type extends keyof RoomEventMap>(type: Type, detail: RoomEventMap[Type]): Uint8Array {
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
					const id = await modelDB.messageEvents.add(event.detail)
					console.log("added message with id", id)
				} else {
					throw new Error("invalid event: invalid event type")
				}
			},
		})
	}

	return roomStoreServices
}
