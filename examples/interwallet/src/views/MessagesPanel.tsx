import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useAccount } from "wagmi"
import { useLiveQuery } from "dexie-react-hooks"

import { db } from "../models/db"

export interface MessagesPanelProps {
	roomId: string
}

export const MessagesPanel: React.FC<MessagesPanelProps> = ({ roomId }: MessagesPanelProps) => {
	const { address: userAddress, isConnected } = useAccount()

	const [message, setMessage] = useState<string>("")
	const messageEvents =
		useLiveQuery(async () => await db.messageEvents.where({ room_id: roomId }).sortBy("timestamp"), [roomId]) || []

	const messagesEndRef = React.useRef<HTMLDivElement>(null)
	const messageInputRef = React.useRef<HTMLInputElement>(null)

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
	}, [messageEvents])

	const handleSubmit = useCallback(
		(e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault()

			if (userAddress) {
				db.messageEvents.add({
					room_id: roomId,
					sender: userAddress,
					message: message,
					timestamp: Date.now(),
				})
			}

			setMessage("")
		},
		[roomId, userAddress, message]
	)

	return (
		<>
			<div
				className="flex flex-col grow ml-3 mr-3 gap-3 overflow-y-auto"
				onClick={() => {
					messageInputRef.current?.focus()
				}}
			>
				{messageEvents.map((message, index) => {
					const is_sent = message.sender == "1"

					const localeString = new Date(message.timestamp).toLocaleString()
					return (
						<div key={index}>
							<div className="flex justify-center text-gray-300">{localeString}</div>
							<div className={`flex ${is_sent ? "flex-row" : "flex-row-reverse"}`}>
								<div
									className={
										is_sent
											? "p-3 rounded-r-lg rounded-tl-lg bg-blue-500 text-white"
											: "p-3 rounded-l-lg rounded-tr-lg bg-gray-200 text-black"
									}
								>
									{message.message}
								</div>
							</div>
						</div>
					)
				})}
				<div ref={messagesEndRef} />
			</div>
			<form className="m-3 flex flex-row" onSubmit={handleSubmit}>
				<input
					ref={messageInputRef}
					className="h-10 w-full rounded-xl bg-gray-100 focus:outline-none pl-2"
					value={message}
					onChange={({ target }) => setMessage(target.value)}
				></input>
			</form>
		</>
	)
}
