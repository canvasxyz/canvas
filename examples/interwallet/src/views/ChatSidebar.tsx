import React, { useCallback, useContext, useEffect } from "react"
import { useEnsName } from "wagmi"
import { useLiveQuery } from "dexie-react-hooks"

import { AppContext } from "../context"
import { NewChatModal } from "./NewChatModal"
import { Room, db } from "../db"

export interface ChatSidebarProps {}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({}) => {
	const [showNewChatModal, setShowNewChatModal] = React.useState(false)
	const { user, manager, roomId, setRoomId } = useContext(AppContext)

	const rooms = useLiveQuery(() => db.rooms.toArray(), [])

	const handleClick = useCallback(
		(room: Room) => {
			if (room.id === roomId) {
				return
			}

			setRoomId(room.id)
		},
		[roomId, setRoomId]
	)

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
				{rooms &&
					rooms.map((room) => (
						<ChatSidebarRoom key={room.id} room={room} selected={room.id === roomId} handleSelect={handleClick} />
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
	selected: boolean
	handleSelect: (room: Room) => void
}

const ChatSidebarRoom: React.FC<ChatSidebarRoomProps> = ({ selected, room, handleSelect }) => {
	const [{ address: address1 }, { address: address2 }] = room.members
	const { data: name1 } = useEnsName({ address: address1 })
	const { data: name2 } = useEnsName({ address: address2 })

	const { setPageTitle } = useContext(AppContext)
	useEffect(() => {
		if (selected) {
			setPageTitle(`${name1 ?? address1} ~ ${name2 ?? address2}`)
		}
	}, [selected, address1, name1, address2, name2])

	if (selected) {
		return (
			<button
				key={room.id}
				className="pt-2 pb-2 pl-2 pr-4 m-2 text-left rounded hover:bg-gray-300 hover:cursor-pointer bg-gray-200"
				disabled={selected}
			>
				<span className="text-sm font-bold">{name1 ?? address1}</span>
				<span className="text-sm"> ~ </span>
				<span className="text-sm font-bold">{name2 ?? address2}</span>
			</button>
		)
	} else {
		return (
			<button
				key={room.id}
				className="pt-2 pb-2 pl-2 pr-4 m-2 text-left rounded hover:bg-gray-300 hover:cursor-pointer bg-gray-50"
				disabled={selected}
				onClick={(e) => handleSelect(room)}
			>
				<span className="text-sm">{name1 ?? address1}</span>
				<span className="text-sm"> ~ </span>
				<span className="text-sm">{name2 ?? address2}</span>
			</button>
		)
	}
}
