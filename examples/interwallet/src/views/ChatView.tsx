import React, { useMemo, useState } from "react"

// import { NewChatModal } from "./NewChatModal"
// import { useEnsName } from "wagmi"

import { ChatSidebar } from "./ChatSidebar"
import { MessagesPanel } from "./MessagesPanel"

import { RoomId } from "../interfaces"
import { rooms } from "../fixtures"

// import { StatusPanel } from "./StatusPanel"

// import { libp2p } from "../stores/libp2p"

export interface ChatViewProps {}

export const ChatView: React.FC<ChatViewProps> = ({}) => {
	const [roomId, setRoomId] = React.useState<RoomId | null>(null)
	// const [address1, address2] = useMemo(() => {
	// 	const room = rooms.find(({ topic }) => topic === roomId)
	// 	return room?.members ?? [undefined, undefined]
	// }, [roomId])

	// const { data: name1 } = useEnsName({ address: address1 })
	// const { data: name2 } = useEnsName({ address: address2 })

	return (
		<div className="flex flex-row grow items-stretch overflow-y-hidden">
			<ChatSidebar roomId={roomId} setRoomId={setRoomId} />

			{roomId === null ? (
				<div className="m-auto text-3xl font-semibold text-gray-500">No chat is selected</div>
			) : (
				<MessagesPanel roomId={roomId} />
			)}
		</div>
	)
}
