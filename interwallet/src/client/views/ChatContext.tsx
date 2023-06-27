import React, { useContext, useEffect, useState } from "react"
import { useDisconnect } from "wagmi"

import { getRegistrationKey } from "../utils.js"

import { PrivateUserRegistration, type Room, serializePublicUserRegistration } from "../../shared/types.js"
import { makeShardedTopic, useSubscriptions } from "../useStore.js"
import { Libp2p } from "libp2p"
import { ServiceMap } from "../libp2p.js"
import {
	ROOM_REGISTRY_TOPIC,
	USER_REGISTRY_TOPIC,
	decryptEvent,
	encryptAndSignMessageForRoom,
	validateEvent,
	validateUserRegistration,
} from "../../shared/index.js"
import { hexToBytes } from "viem"
import * as Messages from "../../shared/messages.js"
import { InterwalletChatDB } from "../db.js"
import { blake3 } from "@noble/hashes/blake3"
import { useLiveQuery } from "dexie-react-hooks"
import { createContext } from "react"
import { SelectedRoomIdContext } from "../SelectedRoomIdContext.js"
import { RoomRegistration, getRoomId } from "../../shared/RoomRegistration.js"
import { SignedRoomRegistration } from "../../shared/SignedRoomRegistration.js"

interface ChatContextType {
	selectedRoom: Room | null
	user: PrivateUserRegistration
	logout: () => void
	db: InterwalletChatDB
	createRoom: (roomRegistration: RoomRegistration) => Promise<void>
	selectedRoomId: string | null
	setSelectedRoomId: (roomId: string | null) => void
	sendMessage: (room: Room, content: string) => Promise<void>
	libp2p: Libp2p<ServiceMap>
}

export const ChatContext = createContext<ChatContextType>({
	selectedRoom: null,
	user: undefined!,
	logout: () => {
		throw new Error("logout not implemented")
	},
	db: undefined!,
	createRoom: () => {
		throw new Error("createRoom not implemented")
	},
	selectedRoomId: null,
	setSelectedRoomId: () => {
		throw new Error("setSelectedRoomId not implemented")
	},
	sendMessage: () => {
		throw new Error("sendMessage not implemented")
	},
	libp2p: undefined!,
})

export const ChatBehaviors = ({
	user,
	setUser,
	libp2p,
	db,
	children,
}: {
	user: PrivateUserRegistration
	setUser: (user: PrivateUserRegistration | null) => void
	libp2p: Libp2p<ServiceMap>
	db: InterwalletChatDB
	children: React.ReactNode
}) => {
	const { disconnect } = useDisconnect()

	const { selectedRoomId, setSelectedRoomId } = useContext(SelectedRoomIdContext)

	const selectedRoom = useLiveQuery(() => db.rooms.get({ id: selectedRoomId || "" }), [selectedRoomId]) || null

	const [subscribedRoomIds, setSubscribedRoomIds] = useState<string[]>([])

	const { stores, unregisterAll } = useSubscriptions(libp2p, {
		[USER_REGISTRY_TOPIC]: {
			apply: async (key: Uint8Array, value: Uint8Array) => {
				const userRegistration = await validateUserRegistration(key, value)
				console.log("user registry message", userRegistration)
				await db.users.add(userRegistration)
			},
		},
		[ROOM_REGISTRY_TOPIC]: {
			apply: async (key: Uint8Array, value: Uint8Array) => {
				const signedRoom = SignedRoomRegistration.decode(value)

				await signedRoom.validate(key)

				const room = signedRoom.getRoomDbEntry()

				console.log("room registry messsage", room)

				// if the current user is a member of the room
				if (room.members.find(({ address }) => address === user.address)) {
					await db.rooms.add(room)
					console.log("adding room to store")
					addRoom(room)
				}
			},
		},
		"interwallet:room-events": {
			shards: subscribedRoomIds,
			apply: async (key: Uint8Array, value: Uint8Array, { shard: roomId }) => {
				const room = await db.rooms.get({ id: roomId })
				if (!room) return

				const { encryptedEvent } = validateEvent(room, key, value)
				console.log("message event", encryptedEvent)

				const event = decryptEvent(encryptedEvent, user)

				// TODO: runtime validation of room event types
				if (event.type === "message") {
					try {
						const id = await db.messages.add({ room: room.id, ...event.detail })
						console.log("added message with id", id)
					} catch (e) {
						console.log(e)
					}
				} else {
					throw new Error("invalid event type")
				}
			},
		},
	})

	useEffect(() => {
		const userRegistry = stores[USER_REGISTRY_TOPIC]
		if (!userRegistry) return

		const key = hexToBytes(user.address)

		// send user registration
		;(async () => {
			const existingRegistration = await userRegistry.get(key)
			if (existingRegistration === null) {
				console.log("publishing self user registration for", key)

				const value = Messages.SignedUserRegistration.encode(serializePublicUserRegistration(user))

				try {
					await userRegistry.insert(key, value)
				} catch (e) {
					console.log(e)
				}
			}
		})()
	}, [stores[USER_REGISTRY_TOPIC]])

	useEffect(() => {
		if (!stores[ROOM_REGISTRY_TOPIC]) return

		// Reload rooms from db
		db.rooms.toArray().then((rooms) => {
			for (const room of rooms) {
				addRoom(room)
			}
		})
	}, [stores[ROOM_REGISTRY_TOPIC]])

	const logout = async () => {
		window.localStorage.removeItem(getRegistrationKey(user.address))

		await db.delete()

		await unregisterAll()

		setSelectedRoomId(null)
		setUser(null)
		disconnect()
	}

	const createRoom: (roomRegistration: RoomRegistration) => Promise<void> = async (roomRegistration) => {
		const signedRoomRegistration = SignedRoomRegistration.sign(roomRegistration, user)
		const data = SignedRoomRegistration.encode(signedRoomRegistration)

		const hash = blake3.create({ dkLen: 16 })
		for (const { address } of roomRegistration.members) {
			hash.update(hexToBytes(address))
		}
		const key = hash.digest()

		const roomRegistry = stores[ROOM_REGISTRY_TOPIC]
		if (!roomRegistry) return

		try {
			await roomRegistry.insert(key, data)
		} catch (e) {
			console.log(e)
		}

		const roomId = getRoomId(key)
		setSelectedRoomId(roomId)
	}

	const addRoom = async (room: Room) => {
		setSubscribedRoomIds((subscribedRoomIds) => [...subscribedRoomIds, room.id])
	}

	const sendMessage = async (room: Room, message: string) => {
		const signedData = encryptAndSignMessageForRoom(room, message, user)

		const key = blake3(signedData, { dkLen: 16 })

		const topic = makeShardedTopic("interwallet:room-events", room.id)
		const store = stores[topic]
		if (!store) {
			throw new Error(`store not found for topic ${topic}`)
		}
		await store.insert(key, signedData)
	}

	return (
		<ChatContext.Provider
			value={{
				selectedRoom,
				user,
				logout,
				db,
				createRoom,
				selectedRoomId,
				setSelectedRoomId,
				sendMessage,
				libp2p,
			}}
		>
			{children}
		</ChatContext.Provider>
	)
}
