import React, { useContext } from "react"

import { useLiveQuery } from "dexie-react-hooks"

import { Room } from "../../shared/index.js"

import { NewChatModal } from "./NewChatModal.js"
import { RoomName } from "./RoomName.js"

import { db } from "../db.js"
import { AppContext } from "../AppContext.js"

export const ChatSidebar = ({}) => {
	const [showNewChatModal, setShowNewChatModal] = React.useState(false)

	const rooms = useLiveQuery(() => db.rooms.toArray(), []) ?? []

	const { user } = useContext(AppContext)
	if (user === null) {
		return null
	}

	return (
		<div>
			<div className="flex flex-col items-stretch">
				<button
					onClick={() => setShowNewChatModal(true)}
					className="p-2 m-2 text-left text-white font-bold text-center rounded hover:bg-blue-800 hover:cursor-pointer bg-blue-600"
				>
					New conversation
				</button>
			</div>
			<div className="overflow-scroll flex flex-col items-stretch">
				{rooms.map((room) => (
					<ChatSidebarRoom key={room.id} room={room} />
				))}
			</div>
			{showNewChatModal && <NewChatModal creator={user} onClose={() => setShowNewChatModal(false)} />}
		</div>
	)
}

interface ChatSidebarRoomProps {
	room: Room
}

const ChatSidebarRoom = ({ room }: ChatSidebarRoomProps) => {
	const { currentRoom, setCurrentRoom } = useContext(AppContext)

	if (room.id === currentRoom?.id) {
		return (
			<button
				key={room.id}
				className="pt-2 pb-2 pl-2 pr-4 m-2 text-left rounded hover:bg-gray-300 hover:cursor-pointer bg-gray-200"
				disabled
			>
				<span className="text-sm font-bold">
					<RoomName room={room} />
				</span>
			</button>
		)
	} else {
		return (
			<button
				key={room.id}
				className="pt-2 pb-2 pl-2 pr-4 m-2 text-left rounded hover:bg-gray-300 hover:cursor-pointer bg-gray-50"
				onClick={(e) => setCurrentRoom(room)}
			>
				<span className="text-sm">
					<RoomName room={room} />
				</span>
			</button>
		)
	}
}
