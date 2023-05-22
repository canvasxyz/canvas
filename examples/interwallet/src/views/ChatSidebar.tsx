import React, { useCallback, useContext, useEffect } from "react"
import { useAccount, useEnsName } from "wagmi"

import { rooms } from "../fixtures"
import type { RoomId, Room } from "../interfaces"
import { AppContext } from "../context"

export interface ChatSizebarProps {
	roomId: string | null
	setRoomId: (roomId: RoomId) => void
}

export const ChatSidebar: React.FC<ChatSizebarProps> = ({ roomId, setRoomId }) => {
	const handleClick = useCallback(
		(room: Room) => {
			if (room.topic === roomId) {
				return
			}

			setRoomId(room.topic)
		},
		[roomId, setRoomId]
	)

	return (
		<div className="basis-64 grow-0 shrink-0 border-r border-gray-300">
			<div className="overflow-scroll flex flex-col items-stretch">
				{rooms.map((room) => (
					<ChatSidebarRoom key={room.topic} room={room} selected={room.topic === roomId} handleSelect={handleClick} />
				))}
			</div>
		</div>
	)
}

interface ChatSidebarRoomProps {
	room: Room
	selected: boolean
	handleSelect: (room: Room) => void
}

const ChatSidebarRoom: React.FC<ChatSidebarRoomProps> = ({ selected, room, handleSelect }) => {
	const [address1, address2] = room.members
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
				key={room.topic}
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
				key={room.topic}
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
