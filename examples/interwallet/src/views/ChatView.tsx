import React, { useEffect, useMemo } from "react"

import { UserRegistration } from "../interfaces"
// import { NewChatModal } from "./NewChatModal"
import { useEnsName } from "wagmi"

import { ChatSidebar } from "./ChatSidebar"
import { MessagesPanel } from "./MessagesPanel"

import { rooms } from "../fixtures"

export interface ChatViewProps {
	address: string
}

export const ChatView: React.FC<{
	userAddress: string
	userRegistration: UserRegistration
}> = ({ userAddress, userRegistration }) => {
	const [roomId, setRoomId] = React.useState<`interwallet:room:${string}` | null>(null)
	const room = useMemo(() => rooms.find(({ topic }) => topic === roomId) ?? null, [roomId])

	const { data: ensName } = useEnsName({ address: roomId as `0x${string}` })

	return (
		<>
			<div className="flex flex-row h-screen overflow-hidden bg-white">
				{/* sidebar */}
				<ChatSidebar userAddress={userAddress} roomId={roomId} setRoomId={setRoomId} />
				{/* main content */}
				<div className="overflow-x-hidden relative flex flex-col grow">
					{/* top bar? */}
					<div className="h-16 p-3 font-bold text-lg flex items-center">{ensName}</div>
					{roomId !== null ? (
						<MessagesPanel userAddress={roomId} roomId={roomId} />
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
