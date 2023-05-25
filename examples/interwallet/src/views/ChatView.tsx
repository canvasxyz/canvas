import React, { useContext } from "react"

import { ChatSidebar } from "./ChatSidebar"
import { MessagesPanel } from "./MessagesPanel"
import { AppContext } from "../context"

export interface ChatViewProps {}

export const ChatView: React.FC<ChatViewProps> = ({}) => {
	const { room } = useContext(AppContext)

	return (
		<div className="flex flex-row grow items-stretch overflow-y-hidden">
			<ChatSidebar />

			{room === null ? (
				<div className="m-auto text-3xl font-semibold text-gray-500">No chat is selected</div>
			) : (
				<MessagesPanel room={room} />
			)}
		</div>
	)
}
