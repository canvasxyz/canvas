import React, { useCallback, useContext, useState } from "react"
import { useDisconnect } from "wagmi"

import { ChatSidebar } from "./ChatSidebar.js"
import { MessagesPanel } from "./MessagesPanel.js"
import { StatusPanel } from "./StatusPanel.js"
import { RoomName } from "./RoomName.js"

import { AppContext } from "../context.js"
import { getRegistrationKey } from "../utils.js"

import { ReactComponent as chevronRight } from "../../../icons/chevron-right.svg"
import { ReactComponent as chevronLeft } from "../../../icons/chevron-left.svg"

export interface ChatViewProps {}

export const ChatView: React.FC<ChatViewProps> = ({}) => {
	const { disconnect } = useDisconnect()
	const { user, setUser, room, setRoom } = useContext(AppContext)

	const [showStatusPanel, setShowStatusPanel] = useState(true)

	const logout = useCallback(async () => {
		if (user !== null) {
			window.localStorage.removeItem(getRegistrationKey(user.address))
		}

		setRoom(null)
		setUser(null)
		disconnect()
	}, [user, disconnect])

	const statusPanelIcon = showStatusPanel ? chevronRight : chevronLeft

	if (user === null) {
		return null
	}

	return (
		<div className="w-screen h-screen bg-white overflow-x-scroll">
			<div className="h-full flex flex-row min-w-min items-stretch">
				<div className="grow grid grid-cols-chat-view grid-rows-chat-view divide-x divide-y divide-gray-300">
					<div className="px-4 self-center">
						<h1 className="">Encrypted Chat</h1>
					</div>
					<div className="flex flex-row">
						<div className="px-4 self-center grow">{room && <RoomName room={room} />}</div>
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
						{room === null ? (
							<div className="px-4 m-auto text-3xl font-semibold text-gray-500">No chat is selected</div>
						) : (
							<MessagesPanel room={room} />
						)}
					</div>
				</div>
				{showStatusPanel && <StatusPanel />}
			</div>
		</div>
	)
}
