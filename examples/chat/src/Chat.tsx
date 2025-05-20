import React, { useEffect, useContext, useRef, useState, useCallback } from "react"
import { Virtuoso, VirtuosoHandle } from "react-virtuoso"

import { useLiveQuery } from "@canvas-js/hooks"

import Chat from "./contract.js"
import { AppContext } from "./AppContext.js"

export interface MessagesProps {
	address: string | null
}

type Message = { id: string; address: string; content: string; timestamp: number }

export const Messages: React.FC<MessagesProps> = ({ address }) => {
	const { app } = useContext(AppContext)
	const virtuosoRef = useRef<VirtuosoHandle>(null)
	const [listHeight, setListHeight] = useState(500)
	const scrollboxRef = useRef<HTMLDivElement | null>(null)

	const messages =
		useLiveQuery<typeof Chat.models, "message">(app, "message", {
			orderBy: { timestamp: "asc" },
		}) || []

	// Calculate container height for the list
	useEffect(() => {
		const updateHeight = () => {
			if (scrollboxRef.current?.parentElement) {
				setListHeight(scrollboxRef.current.parentElement.clientHeight)
			}
		}
		updateHeight()
		window.addEventListener("resize", updateHeight)
		return () => window.removeEventListener("resize", updateHeight)
	}, [])

	return (
		<div className="flex-1" ref={scrollboxRef} style={{ height: listHeight }}>
			<Virtuoso
				ref={virtuosoRef}
				style={{ height: "100%" }}
				totalCount={messages.length}
				data={messages}
				itemContent={(index, message) => (
					<MessageView message={message} previous={index === 0 ? null : messages[index - 1]} />
				)}
				followOutput={"auto"}
				initialTopMostItemIndex={messages.length > 0 ? messages.length - 1 : 0}
			/>
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
		<div className="pt-1">
			<code className="text-sm text-gray-500">{address}</code>
		</div>
	)
}
