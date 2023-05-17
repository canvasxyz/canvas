import React from "react"
import ContactsIcon from "../icons/contacts.svg"
import { IconButton } from "../IconButton"
import { Room } from "../models"

export const ChatSidebar: React.FC<{
	currentUser: { ens: string }
	rooms: { [key: string]: Room }
	setShowUserList: (show: boolean) => void
}> = ({ currentUser, setShowUserList }) => {
	return (
		<div className="w-64 h-full border-solid border-gray-200 border-r flex-col flex shrink">
			<div className="h-16 flex shrink p-3 items-center">Encrypted Chat</div>
			<div className="h-16 flex shrink p-3 items-center">
				<div className="flex-grow">Conversations</div>
				<IconButton
					onClick={async () => {
						setShowUserList(true)
					}}
					icon={ContactsIcon}
					disabled={false}
				/>
			</div>
			<div className="overflow-auto">
				<div
					// key={`node-${note.local_id}`}
					className={`pt-2 pb-2 pl-4 pr-4 m-2 rounded hover:bg-gray-400 hover:cursor-pointer ${
						true ? "bg-gray-200" : "bg-gray-50"
					}`}
					onClick={(e) => {
						e.stopPropagation()
						// select item
					}}
				>
					<div className="text-sm font-bold">{currentUser.ens}</div>
				</div>
			</div>
		</div>
	)
}
