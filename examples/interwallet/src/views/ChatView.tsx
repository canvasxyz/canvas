import React, { useMemo, useState } from "react"

// import { NewChatModal } from "./NewChatModal"
import { useEnsName } from "wagmi"

import { ChatSidebar } from "./ChatSidebar"
import { MessagesPanel } from "./MessagesPanel"

import { RoomId } from "../interfaces"
import { rooms } from "../fixtures"
import { StatusPanel } from "./StatusPanel"

import { libp2p } from "../stores/libp2p"

export interface ChatViewProps {}

export const ChatView: React.FC<ChatViewProps> = ({}) => {
	const [roomId, setRoomId] = React.useState<RoomId | null>(null)
	const [address1, address2] = useMemo(() => {
		const room = rooms.find(({ topic }) => topic === roomId)
		return room?.members ?? [undefined, undefined]
	}, [roomId])

	const { data: name1 } = useEnsName({ address: address1 })
	const { data: name2 } = useEnsName({ address: address2 })

	return (
		<div className="flex flex-row h-screen overflow-hidden bg-white">
			{/* sidebar */}
			<div className="w-64 h-full border-gray-300 border-r flex-col flex shrink">
				<div className="h-16 flex shrink p-3 items-center border-gray-300 border-b">
					<h1 className="w-full">Encrypted Chat</h1>
				</div>
				<ChatSidebar roomId={roomId} setRoomId={setRoomId} />
				<StatusPanel />
			</div>
			{/* main content */}
			<div className="overflow-x-hidden relative flex flex-col grow">
				{/* top bar? */}
				{roomId === null ? (
					<div className="m-auto text-3xl font-semibold text-gray-500">No chat is selected</div>
				) : (
					<>
						<div className="h-16 p-3 font-bold text-lg flex items-center">
							{name1} ~ {name2}
						</div>
						<MessagesPanel roomId={roomId} />
					</>
				)}
			</div>
		</div>
	)
}
