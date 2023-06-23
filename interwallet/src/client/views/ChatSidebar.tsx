import React, { useContext } from "react"
import { useLiveQuery } from "dexie-react-hooks"

import { PrivateUserRegistration, Room } from "../../shared/index.js"

import { NewChatModal } from "./NewChatModal.js"
import { RoomName } from "./RoomName.js"
import { ChatContext } from "./ChatContext.js"

export const ChatSidebar = () => {
	const { db, selectedRoomId, setSelectedRoomId, user } = useContext(ChatContext)

	const [showNewChatModal, setShowNewChatModal] = React.useState(false)

	const rooms = useLiveQuery(() => db.rooms.toArray(), [])

	return (
		<div>
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
					<ChatSidebarRoom
						key={room.id}
						isSelected={!!selectedRoomId && room.id == selectedRoomId}
						room={room}
						selectRoom={() => setSelectedRoomId(room.id)}
						user={user}
					/>
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

const ChatSidebarRoom = ({
	isSelected,
	room,
	selectRoom,
}: {
	isSelected: boolean
	room: Room
	user: PrivateUserRegistration
	selectRoom: () => void
}) => {
	if (isSelected) {
		return (
			<button
				key={room.id}
				className="pt-2 pb-2 pl-2 pr-4 m-2 text-left rounded hover:bg-gray-300 hover:cursor-pointer bg-gray-200"
				disabled={isSelected}
			>
				<span className="text-sm font-bold">
					<RoomName />
				</span>
			</button>
		)
	} else {
		return (
			<button
				key={room.id}
				className="pt-2 pb-2 pl-2 pr-4 m-2 text-left rounded hover:bg-gray-300 hover:cursor-pointer bg-gray-50"
				disabled={isSelected}
				onClick={(e) => selectRoom()}
			>
				<span className="text-sm">
					<RoomName />
				</span>
			</button>
		)
	}
}
