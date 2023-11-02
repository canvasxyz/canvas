import React, { useContext } from "react"

import { useLiveQuery } from "@canvas-js/hooks"

import { AppContext } from "./AppContext.js"
import { AddressView } from "./components/AddressView.js"

export interface MessagesProps {}

type Message = { user: string; content: string; timestamp: number }

export const Messages: React.FC<MessagesProps> = ({}) => {
	const { app } = useContext(AppContext)

	const messages = useLiveQuery<Message>(app, "message", {
		orderBy: { timestamp: "asc" },
	})

	return (
		<div className="flex-1">
			{messages?.map((message, i) => (
				<MessageView key={i} message={message} previous={i === 0 ? null : messages[i - 1]} />
			))}
		</div>
	)
}

interface MessageViewProps {
	previous: Message | null
	message: Message
}

const MessageView: React.FC<MessageViewProps> = ({ message, previous }) => {
	return (
		<div>
			{previous?.user === message.user ? null : <MessageHeader user={message.user} />}
			<div>{message.content}</div>
		</div>
	)
}

interface MessageHeaderProps {
	user: string
}

const MessageHeader: React.FC<MessageHeaderProps> = ({ user }) => {
	// const [chain, chainId, address] = user.split(":")
	return (
		<div className="mt-2">
			<code className="text-sm text-gray-500">{user}</code>
		</div>
	)
}
