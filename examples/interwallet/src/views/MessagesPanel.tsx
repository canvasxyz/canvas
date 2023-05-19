import React, { useEffect, useState } from "react"
import { db } from "../models/db"
import { useLiveQuery } from "dexie-react-hooks"

const toRoomKey = (address1: string, address2: string) => {
	const [a1, a2] = [address1, address2].sort()
	return `interwallet:room:${a1}:${a2}`
}

export const MessagesPanel = ({ address, currentUserAddress }: { address: string; currentUserAddress: string }) => {
	const roomKey = toRoomKey(address, currentUserAddress as string)
	const [message, setMessage] = useState<string>("")
	const messageEvents =
		useLiveQuery(async () => await db.messageEvents.where({ room_id: roomKey }).sortBy("timestamp"), [roomKey]) || []

	const messagesEndRef = React.useRef<HTMLDivElement>(null)
	const messageInputRef = React.useRef<HTMLInputElement>(null)

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
	}, [messageEvents])

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
			<form
				className="m-3 flex flex-row"
				onSubmit={(e) => {
					e.preventDefault()

					db.messageEvents.add({
						room_id: roomKey,
						sender: address,
						message: message,
						timestamp: Date.now(),
					})
					setMessage("")
				}}
			>
				<input
					ref={messageInputRef}
					onChange={(e) => {
						setMessage(e.target.value)
					}}
					value={message}
					className="h-10 w-full rounded-xl bg-gray-100 focus:outline-none pl-2"
				></input>
			</form>
		</>
	)
}
