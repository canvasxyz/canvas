import React, { useEffect, useContext, useRef } from "react"

import { useLiveQuery } from "@canvas-js/hooks"

import { AppContext } from "./AppContext.js"

export interface MessagesProps {}

type Message = { id: string; address: string; content: string; timestamp: number }

export const Messages: React.FC<MessagesProps> = ({}) => {
	const { app } = useContext(AppContext)
	const scrollboxRef = useRef()

	const messages = useLiveQuery<Message>(app, "message", {
		orderBy: { timestamp: "asc" },
	})

	// keep scrolled down
	useEffect(() => {
		const box = scrollboxRef.current?.parentElement
		if (!box) return
		if (box.scrollTop === 0) {
			box.scrollTop = box.scrollHeight
		} else {
			box.scrollTo({ top: box.scrollHeight, behavior: "smooth" })
		}
	}, [messages?.length])

	return (
		<div className="flex-1" ref={scrollboxRef}>
			{messages?.map((message, i) => (
				<MessageView key={message.id} message={message} previous={i === 0 ? null : messages[i - 1]} />
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
			{previous?.address === message.address ? null : <MessageHeader address={message.address} />}
			<div>{message.content}</div>
		</div>
	)
}

interface MessageHeaderProps {
	address: string
}

const MessageHeader: React.FC<MessageHeaderProps> = ({ address }) => {
	return (
		<div className="mt-2">
			<code className="text-sm text-gray-500">{address}</code>
		</div>
	)
}
