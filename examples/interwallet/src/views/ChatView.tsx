import React, { useEffect } from "react"

import { UserRegistration } from "../interfaces"
// import { NewChatModal } from "./NewChatModal"
import { ChatSidebar } from "./ChatSidebar"
import { useEnsName } from "wagmi"
import { MessagesPanel } from "./MessagesPanel"

export const ChatView: React.FC<{
	address: string
	user: UserRegistration
}> = ({ address, user }) => {
	const [currentUserAddress, setCurrentUserAddress] = React.useState<string | null>(null)

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
						<MessagesPanel address={address} currentUserAddress={currentUserAddress} />
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
