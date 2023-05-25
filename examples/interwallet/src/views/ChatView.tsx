import React, { useContext } from "react"

import { ChatSidebar } from "./ChatSidebar"
import { MessagesPanel } from "./MessagesPanel"
import { AppContext } from "../context"

export interface ChatViewProps {}

export const ChatView: React.FC<ChatViewProps> = ({}) => {
	const { roomId } = useContext(AppContext)

	return (
		<div className="flex flex-row grow items-stretch overflow-y-hidden">
			<ChatSidebar />

			{roomId === null ? (
				<div className="m-auto text-3xl font-semibold text-gray-500">No chat is selected</div>
			) : (
				<MessagesPanel roomId={roomId} />
			)}
		</div>
	)
}
