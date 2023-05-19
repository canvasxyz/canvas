import React, { useCallback, useEffect, useState } from "react"
import { useAccount } from "wagmi"
import { useLiveQuery } from "dexie-react-hooks"

import { blake3 } from "@noble/hashes/blake3"

import { modelDB } from "../models/modelDB"
import { libp2p } from "../stores/libp2p"
import { RoomId } from "../interfaces"
import { encodeEvent } from "../stores/services"

export interface MessagesPanelProps {
	roomId: RoomId
}

export const MessagesPanel: React.FC<MessagesPanelProps> = ({ roomId }: MessagesPanelProps) => {
	const { address: userAddress } = useAccount()

	const [message, setMessage] = useState<string>("")
	const messageEvents =
		useLiveQuery(async () => await modelDB.messageEvents.where({ room_id: roomId }).sortBy("timestamp"), [roomId]) || []

	const messagesEndRef = React.useRef<HTMLDivElement>(null)
	const messageInputRef = React.useRef<HTMLInputElement>(null)

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
	}, [messageEvents])

	const handleSubmit = useCallback(
		(e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault()

			if (userAddress === undefined) {
				return
			}

			const value = encodeEvent("message", {
				room_id: roomId,
				sender: userAddress,
				message: message,
				timestamp: Date.now(),
			})

			const key = blake3(value, { dkLen: 16 })

			libp2p.services[roomId]
				.insert(key, value)
				.then(() => setMessage(""))
				.catch((err) => console.error(err))
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
