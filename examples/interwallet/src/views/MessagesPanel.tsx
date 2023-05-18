import React, { useEffect, useState } from "react"
import { db } from "../models/db"
import { MessageList } from "./MessageList"
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

	return (
		<>
			<MessageList messages={messageEvents} />
			{/* <div > */}
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
					onChange={(e) => {
						setMessage(e.target.value)
					}}
					value={message}
					className="h-10 w-full rounded-xl bg-gray-100 focus:outline-none pl-2"
				></input>
			</form>
			{/* </div> */}
		</>
	)
}
