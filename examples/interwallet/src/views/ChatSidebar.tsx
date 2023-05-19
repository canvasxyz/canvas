import React from "react"
import ContactsIcon from "../icons/contacts.svg"
import { IconButton } from "../IconButton"
import { User } from "../interfaces"
import { useEnsName } from "wagmi"

export const ChatSidebar: React.FC<{
	currentUserAddress: string | null
	users: User[]
	selectUser: (address: string) => void
}> = ({ currentUserAddress, users, selectUser }) => {
	return (
		<div className="w-64 h-full border-solid border-gray-200 border-r flex-col flex shrink">
			<div className="h-16 flex shrink p-3 items-center">Encrypted Chat</div>
			<div className="h-16 flex shrink p-3 items-center">
				<div className="flex-grow">Conversations</div>
				<IconButton
					onClick={async () => {
						// setShowUserList(true)
					}}
					icon={ContactsIcon}
					disabled={false}
				/>
			</div>
			<div className="overflow-auto">
				{users.map((user) => {
					const { data } = useEnsName({ address: user.address as `0x${string}` })
					const isCurrentUser = user.address == currentUserAddress
					return (
						<div
							key={user.address}
							className={`pt-2 pb-2 pl-2 pr-4 m-2 rounded hover:bg-gray-400 hover:cursor-pointer ${
								isCurrentUser ? "bg-gray-200" : "bg-gray-50"
							}`}
							onClick={(e) => {
								e.stopPropagation()
								if (isCurrentUser) return
								selectUser(user.address)
							}}
						>
							<div className={`text-sm ${isCurrentUser ? "font-bold" : ""}`}>{data}</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}
