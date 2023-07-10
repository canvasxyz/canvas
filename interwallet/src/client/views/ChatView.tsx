import React, { useCallback, useContext, useState } from "react"

import { ChatSidebar } from "./ChatSidebar.js"
import { MessagesPanel } from "./MessagesPanel.js"
import { StatusPanel } from "./StatusPanel.js"
import { RoomName } from "./RoomName.js"

import { ReactComponent as chevronRight } from "../../../icons/chevron-right.svg"
import { ReactComponent as chevronLeft } from "../../../icons/chevron-left.svg"
import { AppContext } from "../AppContext.js"
import { getRegistrationKey } from "../utils.js"

export interface ChatViewProps {}

export const ChatView = ({}: ChatViewProps) => {
	const [showStatusPanel, setShowStatusPanel] = useState(true)
	const statusPanelIcon = showStatusPanel ? chevronRight : chevronLeft

	const { user, setUser, currentRoom, setCurrentRoom } = useContext(AppContext)

	const logout = useCallback(() => {
		// TODO: clear dexie db and stuff??

		setUser(null)
		setCurrentRoom(null)

		if (user !== null) {
			window.localStorage.removeItem(getRegistrationKey(user.address))
		}
	}, [user])

	if (user === null) {
		return null
	}

	return (
		<div className="w-screen h-screen bg-white overflow-x-scroll">
			<div className="h-full flex flex-row min-w-min items-stretch">
				<div className="grow grid grid-cols-chat-view grid-rows-chat-view divide-x divide-y divide-gray-300">
					<div className="px-4 self-center">
						<h1>Encrypted Chat</h1>
					</div>
					<div className="flex flex-row">
						<div className="px-4 self-center grow">{currentRoom && <RoomName room={currentRoom} />}</div>
						<button className="px-4 self-stretch hover:bg-gray-100" onClick={logout}>
							Logout
						</button>
						<button
							className="px-4 self-stretch hover:bg-gray-100"
							onClick={() => setShowStatusPanel(!showStatusPanel)}
						>
							{statusPanelIcon({ width: 24, height: 24 })}
						</button>
					</div>
					<ChatSidebar />
					<div className="flex flex-row grow items-stretch overflow-y-hidden">
						{currentRoom ? (
							<MessagesPanel />
						) : (
							<div className="px-4 m-auto text-3xl font-semibold text-gray-500">No chat is selected</div>
						)}
					</div>
				</div>
				{showStatusPanel && <StatusPanel />}
			</div>
		</div>
	)
}
