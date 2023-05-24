import React, { useCallback, useContext, useEffect, useState } from "react"
import { useAccount } from "wagmi"
import { useLiveQuery } from "dexie-react-hooks"

import { blake3 } from "@noble/hashes/blake3"

import { modelDB } from "../models/modelDB"
import { libp2p } from "../stores/libp2p"
import { RoomId } from "../interfaces"
import { encodeRoomEvent, RoomEvent } from "../stores/services"
import { AppContext } from "../context"
import { decryptAndVerifyEvent, signAndEncryptEvent } from "../cryptography"

export interface MessagesPanelProps {
	roomId: RoomId
}

export const MessagesPanel: React.FC<MessagesPanelProps> = ({ roomId }: MessagesPanelProps) => {
	const { address: userAddress } = useAccount()

	const [message, setMessage] = useState<string>("")
	const messageEvents =
		useLiveQuery(async () => await modelDB.messages.where({ room: roomId }).sortBy("timestamp"), [roomId]) || []

	const messagesEndRef = React.useRef<HTMLDivElement>(null)
	const messageInputRef = React.useRef<HTMLInputElement>(null)

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
	}, [messageEvents])

	const { user } = useContext(AppContext)

	const handleSubmit = useCallback(
		(e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault()

			if (userAddress === undefined) {
				return
			}
			let trimmedMessage = message.trim()

			if (trimmedMessage === "") {
				setMessage("")
				return
			}

			const messageDetail = {
				room: roomId,
				sender: userAddress,
				message: trimmedMessage,
				timestamp: Date.now(),
			}

			const payload: RoomEvent = {
				type: "message",
				detail: messageDetail,
			}

			if (user !== null) {
				const encryptedDevent = signAndEncryptEvent(user, user.keyBundle, payload)
				console.log("encrypted event", encryptedDevent)
				const decryptedEvent = decryptAndVerifyEvent(user, encryptedDevent)
				console.log("decrypted event", decryptedEvent)
			}

			const value = encodeRoomEvent("message", messageDetail)

			const key = blake3(value, { dkLen: 16 })

			libp2p.services[roomId]
				.insert(key, value)
				.then(() => setMessage(""))
				.catch((err) => console.error(err))
		},
		[roomId, userAddress, message, user]
	)

	return (
		<div className="flex flex-col basis-96 grow overflow-x-hidden">
			<div className="flex flex-col grow m-3 gap-1 overflow-y-scroll" onClick={() => messageInputRef.current?.focus()}>
				{messageEvents.map((message, index) => {
					const previousMessageEvent = messageEvents[index - 1]

					const isContinuation =
						previousMessageEvent &&
						previousMessageEvent.sender == message.sender &&
						message.timestamp - previousMessageEvent.timestamp < 60000

					const isSent = message.sender == userAddress

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
					className="h-10 w-full rounded-xl bg-gray-100 px-3"
					value={message}
					onChange={({ target }) => setMessage(target.value)}
				></input>
			</form>
		</div>
	)
}
