import React, { useContext, useState } from "react"

import { useLiveQuery } from "@canvas-js/modeldb/browser"

import { AppContext } from "./AppContext.js"
import { AddressView } from "./components/AddressView.js"

export interface MessagesProps {}

export const Messages: React.FC<MessagesProps> = ({}) => {
	const { app } = useContext(AppContext)

	const messages = useLiveQuery<{ user: string; content: string; timestamp: number }>(app?.db ?? null, "message", {
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
	previous: { user: string; content: string; timestamp: number } | null
	message: { user: string; content: string; timestamp: number }
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
	const [chain, chainId, address] = user.split(":")
	return (
		<div className="mt-2">
			<AddressView className="text-sm text-gray-500" address={address} />
		</div>
	)
}
