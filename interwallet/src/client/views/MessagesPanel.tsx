import React, { useCallback, useEffect, useRef, useState } from "react"

import { useLiveQuery } from "dexie-react-hooks"
import { getAddress } from "viem"

import { PrivateUserRegistration, Room } from "../../shared/index.js"

import { db } from "../db.js"

export const MessagesPanel = ({
	room,
	user,
	sendMessage,
}: {
	room: Room
	user: PrivateUserRegistration
	sendMessage: (roomId: string, content: string) => Promise<void>
}) => {
	const [message, setMessage] = useState<string>("")
	const messageEvents =
		useLiveQuery(async () => await db.messages.where({ room: room.id }).sortBy("timestamp"), [room.id]) || []

	const messagesEndRef = useRef<HTMLDivElement>(null)
	const messageInputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
	}, [messageEvents])

	const handleSubmit = useCallback(
		async (e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault()
			console.log(message)

			const trimmedMessage = message.trim()

			if (trimmedMessage === "") {
				setMessage("")
				return
			}

			if (user === null) {
				console.error("user is null")
				return
			}

			try {
				await sendMessage(room.id, trimmedMessage)
				setMessage("")
			} catch (e) {
				console.error(e)
			}
		},
		[room.id, message, user]
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

							{!isSent && !isContinuation && (
								<div className={`flex flex-row text-sm text-gray-200`}>{message.sender}</div>
							)}

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
