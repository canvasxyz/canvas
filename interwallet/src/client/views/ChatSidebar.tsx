import React from "react"
import { useLiveQuery } from "dexie-react-hooks"

import { PrivateUserRegistration, PublicUserRegistration, Room } from "../../shared/index.js"

import { NewChatModal } from "./NewChatModal.js"
import { RoomName } from "./RoomName.js"
import { InterwalletChatDB } from "../db.js"

export const ChatSidebar = ({
	db,
	selectedRoom,
	createRoom,
	setRoom,
	user,
}: {
	db: InterwalletChatDB
	selectedRoom: Room | null
	createRoom: (members: PublicUserRegistration[]) => Promise<void>
	setRoom: (room: Room) => void
	user: PrivateUserRegistration
}) => {
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
						isSelected={!!selectedRoom && room.id == selectedRoom.id}
						room={room}
						setRoom={setRoom}
						user={user}
					/>
				))}
			</div>
			{showNewChatModal && (
				<NewChatModal
					db={db}
					user={user}
					closeModal={() => {
						setShowNewChatModal(false)
					}}
					createRoom={createRoom}
				/>
			)}
		</div>
	)
}

const ChatSidebarRoom = ({
	isSelected,
	room,
	user,
	setRoom,
}: {
	isSelected: boolean
	room: Room
	user: PrivateUserRegistration
	setRoom: (room: Room) => void
}) => {
	if (isSelected) {
		return (
			<button
				key={room.id}
				className="pt-2 pb-2 pl-2 pr-4 m-2 text-left rounded hover:bg-gray-300 hover:cursor-pointer bg-gray-200"
				disabled={isSelected}
			>
				<span className="text-sm font-bold">
					<RoomName user={user} room={room} />
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
					<RoomName user={user} room={room} />
				</span>
			</button>
		)
	}
}
