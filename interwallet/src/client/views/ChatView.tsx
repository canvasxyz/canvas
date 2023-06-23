import React, { useContext, useEffect, useState } from "react"
import { useDisconnect } from "wagmi"

import { ChatSidebar } from "./ChatSidebar.js"
import { MessagesPanel } from "./MessagesPanel.js"
import { StatusPanel } from "./StatusPanel.js"
import { RoomName } from "./RoomName.js"

import { getRegistrationKey } from "../utils.js"

import { ReactComponent as chevronRight } from "../../../icons/chevron-right.svg"
import { ReactComponent as chevronLeft } from "../../../icons/chevron-left.svg"
import { PrivateUserRegistration, Room, RoomRegistration, serializePublicUserRegistration } from "../../shared/types.js"
import { makeShardedTopic, useSubscriptions } from "../useStore.js"
import { Libp2p } from "libp2p"
import { ServiceMap } from "../libp2p.js"
import {
	ROOM_REGISTRY_TOPIC,
	USER_REGISTRY_TOPIC,
	decryptEvent,
	encryptAndSignMessageForRoom,
	getRoomId,
	signAndEncodeRoomRegistration,
	validateEvent,
	validateRoomRegistration,
	validateUserRegistration,
} from "../../shared/index.js"
import { hexToBytes } from "viem"
import * as Messages from "../../shared/messages.js"
import { InterwalletChatDB } from "../db.js"
import { blake3 } from "@noble/hashes/blake3"
import { useLibp2p } from "../useLibp2p.js"
import { SelectedRoomIdContext } from "../SelectedRoomIdContext.js"
import { useLiveQuery } from "dexie-react-hooks"
import { ChatBehaviors, ChatContext } from "./ChatContext.js"

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
		<ChatBehaviors libp2p={libp2p} user={user} setUser={setUser} db={db}>
			<ChatView />
		</ChatBehaviors>
	)
}

const ChatView = () => {
	const [showStatusPanel, setShowStatusPanel] = useState(true)
	const statusPanelIcon = showStatusPanel ? chevronRight : chevronLeft

	const { selectedRoom, logout } = useContext(ChatContext)

	return (
		<div className="w-screen h-screen bg-white overflow-x-scroll">
			<div className="h-full flex flex-row min-w-min items-stretch">
				<div className="grow grid grid-cols-chat-view grid-rows-chat-view divide-x divide-y divide-gray-300">
					<div className="px-4 self-center">
						<h1 className="">Encrypted Chat</h1>
					</div>
					<div className="flex flex-row">
						<div className="px-4 self-center grow">{selectedRoom && <RoomName />}</div>
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
					<ChatSidebar />
					<div className="flex flex-row grow items-stretch overflow-y-hidden">
						{selectedRoom ? (
							<MessagesPanel />
						) : (
							<div className="px-4 m-auto text-3xl font-semibold text-gray-500">No chat is selected</div>
						)}
					</div>
				</div>
				{showStatusPanel && <StatusPanel />}
			</div>
		</div>
	)
}
