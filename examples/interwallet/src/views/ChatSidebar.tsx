import React, { useCallback, useContext, useEffect } from "react"
import { useEnsName } from "wagmi"
import { useLiveQuery } from "dexie-react-hooks"

import { AppContext } from "../context"
import { NewChatModal } from "./NewChatModal"
import { Room, db } from "../db"
import { RoomName } from "./RoomName"

export interface ChatSidebarProps {}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({}) => {
	const [showNewChatModal, setShowNewChatModal] = React.useState(false)

	const rooms = useLiveQuery(() => db.rooms.toArray(), [])

	return (
		<div className="basis-64 grow-0 shrink-0 border-r border-gray-300">
			<div className="flex flex-col items-stretch">
				<button
					onClick={() => {
						setShowNewChatModal(true)
					}}
					className="p-2 m-2 text-left text-white font-bold text-center rounded hover:bg-blue-800 hover:cursor-pointer bg-blue-600"
				>
					New conversation
				</button>
			</div>
			<div className="overflow-scroll flex flex-col items-stretch">
				{rooms?.map((room) => (
					<ChatSidebarRoom key={room.id} room={room} />
				))}
			</div>
			{showNewChatModal && (
				<NewChatModal
					closeModal={() => {
						setShowNewChatModal(false)
					}}
				/>
			)}
		</div>
	)
}

interface ChatSidebarRoomProps {
	room: Room
}

const ChatSidebarRoom: React.FC<ChatSidebarRoomProps> = ({ room }) => {
	const { room: selectedRoom, setRoom } = useContext(AppContext)
	const isSelected = selectedRoom !== null && selectedRoom.id === room.id

	if (isSelected) {
		return (
			<button
				key={room.id}
				className="pt-2 pb-2 pl-2 pr-4 m-2 text-left rounded hover:bg-gray-300 hover:cursor-pointer bg-gray-200"
				disabled={isSelected}
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
				disabled={isSelected}
				onClick={(e) => setRoom(room)}
			>
				<span className="text-sm">
					<RoomName room={room} />
				</span>
			</button>
		)
	}
}
