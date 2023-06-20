import React, { useContext, useEffect, useRef, useState } from "react"
import { useDisconnect } from "wagmi"

import { ChatSidebar } from "./ChatSidebar.js"
import { MessagesPanel } from "./MessagesPanel.js"
import { StatusPanel } from "./StatusPanel.js"
import { RoomName } from "./RoomName.js"

import { getRegistrationKey } from "../utils.js"

import { ReactComponent as chevronRight } from "../../../icons/chevron-right.svg"
import { ReactComponent as chevronLeft } from "../../../icons/chevron-left.svg"
import { PrivateUserRegistration, Room, RoomRegistration, serializePublicUserRegistration } from "../../shared/types.js"
import { useSubscription } from "../useStore.js"
import { Libp2p } from "libp2p"
import { ServiceMap } from "../libp2p.js"
import {
	ROOM_REGISTRY_TOPIC,
	USER_REGISTRY_TOPIC,
	decryptEvent,
	encryptAndSignMessageForRoom,
	signAndEncodeRoomRegistration,
	validateEvent,
	validateRoomRegistration,
	validateUserRegistration,
} from "../../shared/index.js"
import { hexToBytes } from "viem"
import * as Messages from "../../shared/messages.js"
import { InterwalletChatDB } from "../db.js"
import { base58btc } from "multiformats/bases/base58"
import { blake3 } from "@noble/hashes/blake3"
import { useLibp2p } from "../useLibp2p.js"
import { SelectedRoomIdContext } from "../SelectedRoomIdContext.js"
import { useLiveQuery } from "dexie-react-hooks"

const useInterwalletChatDB = () => {
	const [db, setDb] = useState<InterwalletChatDB | null>(null)

	useEffect(() => {
		const newDb = new InterwalletChatDB()
		setDb(newDb)
		return () => {
			newDb.close()
		}
	}, [])

	return { db }
}

export const LoggedInView = ({
	user,
	setUser,
}: {
	user: PrivateUserRegistration
	setUser: (user: PrivateUserRegistration | null) => void
}) => {
	const { libp2p } = useLibp2p()
	const { db } = useInterwalletChatDB()

	return libp2p === null || db === null ? (
		"Loading..."
	) : (
		<ChatView libp2p={libp2p} user={user} setUser={setUser} db={db} />
	)
}

export const ChatView = ({
	user,
	setUser,
	libp2p,
	db,
}: {
	user: PrivateUserRegistration
	setUser: (user: PrivateUserRegistration | null) => void
	libp2p: Libp2p<ServiceMap>
	db: InterwalletChatDB
}) => {
	const { disconnect } = useDisconnect()

	const { selectedRoomId, setSelectedRoomId } = useContext(SelectedRoomIdContext)

	const selectedRoom = useLiveQuery(() => db.rooms.get({ id: selectedRoomId || "" }), [selectedRoomId])

	const [showStatusPanel, setShowStatusPanel] = useState(true)

	const alreadyRegistered = useRef(false)
	const { register, unregisterAll, stores } = useSubscription(libp2p)

	useEffect(() => {
		// using ref here is a hack to get around the fact that useEffect fires twice
		// when using StrictMode when in development mode

		// a better approach would be to implement register() and the Store so that if we
		// try to register the same topic twice, it doesn't do anything or it throws an error
		// that we can then catch and ignore
		if (alreadyRegistered.current) return

		register(USER_REGISTRY_TOPIC, async (key: Uint8Array, value: Uint8Array) => {
			const userRegistration = await validateUserRegistration(key, value)
			console.log("user registry message", userRegistration)
			await db.users.add(userRegistration)
		})

		register(ROOM_REGISTRY_TOPIC, async (key: Uint8Array, value: Uint8Array) => {
			const room = await validateRoomRegistration(key, value)
			console.log("room registry messsage", room)

			// if the current user is a member of the room
			if (room.members.find(({ address }) => address === user.address)) {
				await db.rooms.add(room)
				console.log("adding room to store")
				addRoom(db, room)
			}
		})

		alreadyRegistered.current = true
	}, [])

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
				addRoom(db, room)
			}
		})
	}, [stores[ROOM_REGISTRY_TOPIC]])

	const logout = async () => {
		window.localStorage.removeItem(getRegistrationKey(user.address))

		await unregisterAll()
		await db.delete()

		setSelectedRoomId(null)
		setUser(null)
		disconnect()
	}

	const createRoom: (roomRegistration: RoomRegistration) => Promise<void> = async (roomRegistration) => {
		const signedRoomRegistration = signAndEncodeRoomRegistration(roomRegistration, user)

		const hash = blake3.create({ dkLen: 16 })
		for (const { address } of roomRegistration.members) {
			hash.update(hexToBytes(address))
		}
		const key = hash.digest()

		const roomRegistry = stores[ROOM_REGISTRY_TOPIC]
		if (!roomRegistry) return

		try {
			await roomRegistry.insert(key, signedRoomRegistration)
		} catch (e) {
			console.log(e)
		}

		const roomId = base58btc.baseEncode(key)
		await db.rooms.add({ id: roomId, ...roomRegistration })

		setSelectedRoomId(roomId)
	}

	const addRoom = async (db: InterwalletChatDB, room: Room) => {
		const topic = `interwallet:room:${room.id}`
		console.log("registering for room topic", topic)
		await register(topic, async (key: Uint8Array, value: Uint8Array) => {
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
		})
	}

	const sendMessage = async (room: Room, message: string) => {
		const signedData = encryptAndSignMessageForRoom(room, message, user)

		const key = blake3(signedData, { dkLen: 16 })

		const topic = `interwallet:room:${room.id}`
		const store = stores[topic]
		if (!store) {
			throw new Error(`store not found for topic ${topic}`)
		}
		await store.insert(key, signedData)
	}

	const statusPanelIcon = showStatusPanel ? chevronRight : chevronLeft

	return (
		<div className="w-screen h-screen bg-white overflow-x-scroll">
			<div className="h-full flex flex-row min-w-min items-stretch">
				<div className="grow grid grid-cols-chat-view grid-rows-chat-view divide-x divide-y divide-gray-300">
					<div className="px-4 self-center">
						<h1 className="">Encrypted Chat</h1>
					</div>
					<div className="flex flex-row">
						<div className="px-4 self-center grow">{selectedRoom && <RoomName user={user} room={selectedRoom} />}</div>
						<button className="px-4 self-stretch hover:bg-gray-100" onClick={logout}>
							Logout
						</button>
						<button
							className="px-4 self-stretch hover:bg-gray-100"
							onClick={() => setShowStatusPanel(!showStatusPanel)}
						>
							{statusPanelIcon({ width: 24, height: 24 })}
						</button>
					</div>
					<ChatSidebar
						db={db}
						createRoom={createRoom}
						selectedRoomId={selectedRoomId}
						setSelectedRoomId={setSelectedRoomId}
						user={user}
					/>
					<div className="flex flex-row grow items-stretch overflow-y-hidden">
						{selectedRoom ? (
							<MessagesPanel db={db} room={selectedRoom} user={user} sendMessage={sendMessage} />
						) : (
							<div className="px-4 m-auto text-3xl font-semibold text-gray-500">No chat is selected</div>
						)}
					</div>
				</div>
				{showStatusPanel && <StatusPanel libp2p={libp2p} />}
			</div>
		</div>
	)
}
