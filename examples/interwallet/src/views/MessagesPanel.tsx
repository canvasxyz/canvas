import React, { useCallback, useContext, useEffect, useRef, useState } from "react"

import { useLiveQuery } from "dexie-react-hooks"

import { db } from "../db"
import { AppContext } from "../context"

export interface MessagesPanelProps {
	roomId: string
}

// const MessageDisplay: React.FC<{
// 	message: Message
// 	isContinuation: boolean
// 	isSent: boolean
// }> = ({ message, isContinuation, isSent }) => {
// 	const localeString = new Date(message.timestamp).toLocaleString()
// 	return (
// 		<div>
// 			{!isContinuation && <div className="flex justify-center text-gray-300">{localeString}</div>}

// 			<div className={`flex ${isSent ? "flex-row-reverse" : "flex-row"}`}>
// 				<div
// 					title={`Sent at ${localeString}`}
// 					className={
// 						isSent
// 							? "p-3 rounded-l-lg rounded-tr-lg bg-blue-500 text-white"
// 							: "p-3 rounded-r-lg rounded-tl-lg bg-gray-200 text-black"
// 					}
// 				>
// 					{message.message}
// 				</div>
// 			</div>
// 		</div>
// 	)
// }

export const MessagesPanel: React.FC<MessagesPanelProps> = ({ roomId }: MessagesPanelProps) => {
	const [message, setMessage] = useState<string>("")
	const messageEvents =
		useLiveQuery(async () => await db.messages.where({ room: roomId }).sortBy("timestamp"), [roomId]) || []

	const messagesEndRef = useRef<HTMLDivElement>(null)
	const messageInputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
	}, [messageEvents])

	const { user, manager } = useContext(AppContext)

	const handleSubmit = useCallback(
		(e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault()

			const trimmedMessage = message.trim()

			if (trimmedMessage === "") {
				setMessage("")
				return
			}

			if (manager !== null) {
				manager
					.dispatchEvent({
						room: roomId,
						type: "message",
						detail: { content: trimmedMessage, timestamp: Date.now() },
					})
					.then(() => console.log("dispatched message event"))
					.catch((err) => console.error("event dispatch error", err))
			}
		},
		[roomId, message, user, manager]
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

					const isSent = message.sender == user?.address

					const localeString = new Date(message.timestamp).toLocaleString()
					return (
						<div key={index}>
							{!isContinuation && <div className="flex justify-center text-gray-300">{localeString}</div>}

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
