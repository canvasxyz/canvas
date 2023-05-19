import React, { useEffect, useMemo } from "react"

// import { NewChatModal } from "./NewChatModal"
import { useEnsName } from "wagmi"

import { ChatSidebar } from "./ChatSidebar"
import { MessagesPanel } from "./MessagesPanel"

import { RoomId } from "../interfaces"
import { rooms } from "../fixtures"

export interface ChatViewProps {}

export const ChatView: React.FC<ChatViewProps> = ({}) => {
	const [roomId, setRoomId] = React.useState<RoomId | null>(null)
	const [address1, address2] = useMemo(() => {
		const room = rooms.find(({ topic }) => topic === roomId)
		return room?.members ?? [undefined, undefined]
	}, [roomId])

	const { data: name1 } = useEnsName({ address: address1 })
	const { data: name2 } = useEnsName({ address: address2 })

	return (
		<>
			<div className="flex flex-row h-screen overflow-hidden bg-white">
				{/* sidebar */}
				<ChatSidebar roomId={roomId} setRoomId={setRoomId} />
				{/* main content */}
				<div className="overflow-x-hidden relative flex flex-col grow">
					{/* top bar? */}
					{roomId === null ? (
						<div className="m-auto text-3xl font-semibold text-gray-500">No chat is selected</div>
					) : (
						<>
							<div className="h-16 p-3 font-bold text-lg flex items-center">
								{name1} ~ {name2}
							</div>
							<MessagesPanel roomId={roomId} />
						</>
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
