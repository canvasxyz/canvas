import React, { useCallback, useContext, useEffect, useRef, useState } from "react"

import { useLiveQuery } from "dexie-react-hooks"
import { getAddress } from "viem"

import { db } from "../db.js"
import { AppContext } from "../AppContext.js"
import { publishEvent } from "../stores.js"

export const MessagesPanel = () => {
	const { currentRoom, user } = useContext(AppContext)

	const [draftContent, setDraftContent] = useState<string>("")
	const messages =
		useLiveQuery(
			async () => (currentRoom ? await db.messages.where({ room: currentRoom.id }).sortBy("timestamp") : []),
			[currentRoom]
		) ?? []

	const messagesEndRef = useRef<HTMLDivElement>(null)
	const messageInputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
	}, [messages])

	const handleSubmit = useCallback(
		(e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault()

			if (currentRoom === null || user === null) {
				return
			}

			const content = draftContent.trim()

			if (content === "") {
				setDraftContent("")
				return
			}

			publishEvent(currentRoom.id, "message", { content })
				.then(() => setDraftContent(""))
				.catch((err) => alert(err.toString()))
		},
		[currentRoom, draftContent, user]
	)

	return (
		<div className="flex flex-col basis-96 grow overflow-x-hidden">
			<div className="flex flex-col grow m-3 gap-1 overflow-y-scroll" onClick={() => messageInputRef.current?.focus()}>
				{messages.map((message, index) => {
					const previousMessageEvent = messages[index - 1]

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
					value={draftContent}
					onChange={({ target }) => setDraftContent(target.value)}
				></input>
			</form>
		</div>
	)
}
