import React, { useEffect } from "react"

import { UserRegistration } from "../interfaces"
// import { NewChatModal } from "./NewChatModal"
import { ChatSidebar } from "./ChatSidebar"
import { MessageList } from "./MessageList"
import { useEnsName } from "wagmi"
import { db } from "../models/db"
import { useLiveQuery } from "dexie-react-hooks"

const toRoomKey = (address1: string, address2: string) => {
	const [a1, a2] = [address1, address2].sort()
	return `interwallet:room:${a1}:${a2}`
}

export const ChatView: React.FC<{
	address: string
	user: UserRegistration
}> = ({ address, user }) => {
	// const [showUserList, setShowUserList] = React.useState<boolean>(false)
	const [message, setMessage] = React.useState<string>("")

	const [currentUserAddress, setCurrentUserAddress] = React.useState<string | null>(null)
	const roomKey = toRoomKey(address, currentUserAddress as string)

	const messageEvents =
		useLiveQuery(async () => await db.messageEvents.where({ room_id: roomKey }).sortBy("timestamp"), [roomKey]) || []

	useEffect(() => {
		console.log(messageEvents)
	}, [messageEvents])

	const users = [
		{
			address: "0x2AdC396D8092D79Db0fA8a18fa7e3451Dc1dFB37",
		},
		{
			address: "0xBAfb51e8b95ad343Bfe79b2F7d32FCa27a74db0c",
		},
	]

	const { data: ensName } = useEnsName({ address: currentUserAddress as `0x${string}` })

	return (
		<>
			<div className="flex flex-row h-screen overflow-hidden bg-white">
				{/* sidebar */}
				<ChatSidebar currentUserAddress={currentUserAddress} selectUser={setCurrentUserAddress} users={users} />
				{/* main content */}
				<div className="overflow-x-hidden relative flex flex-col grow">
					{/* top bar? */}
					<div className="h-16 p-3 font-bold text-lg flex items-center">{ensName}</div>
					{currentUserAddress !== null ? (
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
					) : (
						<div className="m-auto text-3xl font-semibold text-gray-500">No chat is selected</div>
					)}
				</div>
			</div>
			{/* {showUserList && (
				<NewChatModal
					closeModal={() => {
						setShowUserList(false)
					}}
					selectUser={startChat}
					userRegistrations={userRegistrations}
				/>
			)} */}
		</>
	)
}
