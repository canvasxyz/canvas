import React, { useCallback } from "react"
import { useAccount, useEnsName } from "wagmi"

import { rooms } from "../fixtures"
import type { RoomId } from "../interfaces"

export interface ChatSizebarProps {
	roomId: string | null
	setRoomId: (roomId: RoomId) => void
}

export const ChatSidebar: React.FC<ChatSizebarProps> = (props) => {
	const handleClick = useCallback(
		(roomId: RoomId) => {
			if (roomId === props.roomId) {
				return
			} else {
				props.setRoomId(roomId)
			}
		},
		[props.roomId, props.setRoomId]
	)

	return (
		<div className="h-full">
			<div className="overflow-auto flex flex-col items-stretch">
				{rooms.map(({ topic: roomId, members }) => {
					const [address1, address2] = members
					const { data: name1 } = useEnsName({ address: address1 })
					const { data: name2 } = useEnsName({ address: address2 })

					if (roomId === props.roomId) {
						return (
							<button
								key={roomId}
								className="pt-2 pb-2 pl-2 pr-4 m-2 text-left rounded hover:bg-gray-300 hover:cursor-pointer bg-gray-200"
							>
								<span className="text-sm font-bold">{name1 ?? address1}</span>
								<span className="text-sm"> ~ </span>
								<span className="text-sm font-bold">{name2 ?? address2}</span>
							</button>
						)
					} else {
						return (
							<button
								key={roomId}
								className="pt-2 pb-2 pl-2 pr-4 m-2 text-left rounded hover:bg-gray-300 hover:cursor-pointer bg-gray-50"
								onClick={(e) => handleClick(roomId)}
							>
								<span className="text-sm">{name1 ?? address1}</span>
								<span className="text-sm"> ~ </span>
								<span className="text-sm">{name2 ?? address2}</span>
							</button>
						)
					}
				})}
			</div>
		</div>
	)
}
