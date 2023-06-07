import React, { useCallback, useContext, useEffect, useRef, useState } from "react"

import { useLiveQuery } from "dexie-react-hooks"
import { getAddress } from "viem"

import { Room } from "../../shared/index.js"

import { db } from "../db.js"
import { AppContext } from "../context.js"

export interface MessagesPanelProps {
	room: Room
}

export const MessagesPanel: React.FC<MessagesPanelProps> = ({ room }: MessagesPanelProps) => {
	const [message, setMessage] = useState<string>("")
	const messageEvents =
		useLiveQuery(async () => await db.messages.where({ room: room.id }).sortBy("timestamp"), [room.id]) || []

	const messagesEndRef = useRef<HTMLDivElement>(null)
	const messageInputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
	}, [messageEvents])

	const { user, manager } = useContext(AppContext)

	const handleSubmit = useCallback(
		async (e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault()

			const trimmedMessage = message.trim()

			if (trimmedMessage === "") {
				setMessage("")
				return
			}

			if (user === null) {
				console.error("user is null")
				return
			}

			if (manager !== null) {
				try {
					await manager.dispatchEvent(room.id, {
						type: "message",
						detail: { content: trimmedMessage, sender: user.address, timestamp: Date.now() },
					})

					console.log("dispatched message event")
					setMessage("")
				} catch (err) {
					console.error("event dispatch error", err)
				}
			}
		},
		[room.id, message, user, manager]
	)

	return (
		<div className="flex flex-col basis-96 grow overflow-x-hidden">
			<div className="flex flex-col grow m-3 gap-1 overflow-y-scroll" onClick={() => messageInputRef.current?.focus()}>
				{messageEvents.map((message, index) => {
					const previousMessageEvent = messageEvents[index - 1]

					// if the message was sent less than a minute after the previous message, then display them together
					const isContinuation =
						previousMessageEvent &&
						previousMessageEvent.sender == message.sender &&
						message.timestamp - previousMessageEvent.timestamp < 60000

					const isSent = getAddress(message.sender) == user?.address

					const localeString = new Date(message.timestamp).toLocaleString()
					return (
						<div key={index}>
							{!isContinuation && <div className="flex justify-center text-gray-300">{localeString}</div>}

							{!isSent && <div className={`flex flex-row text-sm text-gray-200`}>{message.sender}</div>}

							<div className={`flex ${isSent ? "flex-row-reverse" : "flex-row"}`}>
								<div
									title={`Sent at ${localeString}`}
									className={
										isSent
											? "p-3 rounded-l-lg rounded-tr-lg bg-blue-500 text-white"
											: "p-3 rounded-r-lg rounded-tl-lg bg-gray-200 text-black"
									}
								>
									{message.content}
								</div>
							</div>
						</div>
					)
				})}
				<div ref={messagesEndRef} />
			</div>
			<form className="mb-3 ml-3 mr-3 flex flex-row" onSubmit={handleSubmit}>
				<input
					ref={messageInputRef}
					className="h-10 w-full rounded-xl bg-gray-100 px-3"
					value={message}
					onChange={({ target }) => setMessage(target.value)}
				></input>
			</form>
		</div>
	)
}
