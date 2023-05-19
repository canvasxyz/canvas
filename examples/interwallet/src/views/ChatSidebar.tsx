import React, { useCallback } from "react"
import { useEnsName } from "wagmi"

import { rooms } from "../fixtures"
import type { RoomId } from "../interfaces"
import { isAddress } from "viem"

export interface ChatSizebarProps {
	userAddress: string
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
		<div className="w-64 h-full border-solid border-gray-200 border-r flex-col flex shrink">
			<div className="h-16 flex shrink p-3 items-center">Encrypted Chat</div>
			<div className="h-16 flex shrink p-3 items-center">
				<div className="flex-grow">Conversations</div>
			</div>
			<div className="overflow-auto">
				{rooms.map(({ topic: roomId, members }) => {
					const [address1, address2] = members
					const { data: name1 } = useEnsName({ address: address1 })
					const { data: name2 } = useEnsName({ address: address2 })

					if (roomId === props.roomId) {
						return (
							<div
								key={roomId}
								className={`pt-2 pb-2 pl-2 pr-4 m-2 rounded hover:bg-gray-400 hover:cursor-pointer bg-gray-200`}
							>
								<span className={`text-sm font-bold`}>{name1 ?? address1}</span>
								<span> ~ </span>
								<span className={`text-sm font-bold`}>{name2 ?? address2}</span>
							</div>
						)
					} else {
						return (
							<div
								key={roomId}
								className={`pt-2 pb-2 pl-2 pr-4 m-2 rounded hover:bg-gray-400 hover:cursor-pointer bg-gray-50`}
								onClick={(e) => handleClick(roomId)}
							>
								<span className={`text-sm`}>{name1 ?? address1}</span>
								<span> ~ </span>
								<span className={`text-sm`}>{name2 ?? address2}</span>
							</div>
						)
					}
				})}
			</div>
		</div>
	)
}
