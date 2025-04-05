import React, { useEffect, useContext, useRef, useState, useCallback } from "react"
import { VariableSizeList, ListChildComponentProps } from "react-window"

import { useLiveQuery } from "@canvas-js/hooks"

import { models } from "./contract.js"
import { AppContext } from "./AppContext.js"

export interface MessagesProps {
	address: string | null
}

type Message = { id: string; address: string; content: string; timestamp: number }

export const Messages: React.FC<MessagesProps> = ({ address }) => {
	const { app } = useContext(AppContext)
	const scrollboxRef = useRef<HTMLDivElement | null>(null)
	const listRef = useRef<VariableSizeList>(null)
	const [listHeight, setListHeight] = useState(500)
	const sizeMap = useRef<{ [key: string]: number }>({})
	const rowHeightEstimator = useRef<{ [key: string]: HTMLDivElement }>({})

	const messages =
		useLiveQuery<typeof models, "message">(app, "message", {
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

	// Function to measure row height
	const setRowRef = useCallback(
		(index: number, node: HTMLDivElement | null) => {
			if (node && messages[index]) {
				const messageId = messages[index].id
				rowHeightEstimator.current[messageId] = node

				// Update cache and resize list if height changed
				const newHeight = node.getBoundingClientRect().height
				if (sizeMap.current[messageId] !== newHeight) {
					sizeMap.current[messageId] = newHeight
					if (listRef.current) {
						listRef.current.resetAfterIndex(index)
					}
				}
			}
		},
		[messages],
	)

	const getRowHeight = (index: number) => {
		const message = messages[index]
		// Use cached height or default to a reasonable estimate
		return (
			sizeMap.current[message.id] ||
			// If previous message is from same user, height is smaller
			(index > 0 && messages[index - 1]?.address === message.address ? 25 : 52)
		)
	}

	// keep scrolled down when new messages arrive
	useEffect(() => {
		if (listRef.current && messages.length > 0) {
			listRef.current.scrollToItem(messages.length - 1, "end")
		}
	}, [address, messages.length])

	// Row renderer function for the virtualized list
	const MessageRow = ({ index, style }: ListChildComponentProps) => (
		<div style={style} ref={(node) => setRowRef(index, node)}>
			<MessageView message={messages[index]} previous={index === 0 ? null : messages[index - 1]} />
		</div>
	)

	return (
		<div className="flex-1" ref={scrollboxRef}>
			<VariableSizeList
				ref={listRef}
				height={listHeight}
				width="100%"
				itemCount={messages.length}
				itemSize={getRowHeight}
				overscanCount={5} // Number of items to render outside of the visible area
				estimatedItemSize={25} // Reasonable default
				itemKey={(index) => messages[index].id}
			>
				{MessageRow}
			</VariableSizeList>
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
