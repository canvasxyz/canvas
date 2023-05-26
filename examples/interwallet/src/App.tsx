import React, { useState, useContext, useCallback, useEffect, useRef, useMemo } from "react"

import { useAccount, useConnect, useDisconnect } from "wagmi"
import { PeerId } from "@libp2p/interface-peer-id"

import { ChatView } from "./views/ChatView"
import { RegistrationView } from "./views/RegistrationView"
import { SelectWalletView } from "./views/SelectWalletView"
import { PrivateUserRegistration } from "./interfaces"
import { getRegistrationKey } from "./cryptography"

import { AppContext } from "./context"

import chevronRight from "./icons/chevron-right.svg"
import chevronLeft from "./icons/chevron-left.svg"
import { StatusPanel } from "./views/StatusPanel"
import { RoomManager } from "./manager"

import { getPeerId } from "./libp2p"
import { Room } from "./db"
import { RoomName } from "./views/RoomName"

const AppContent: React.FC<{}> = ({}) => {
	const { connect, connectors } = useConnect()
	const { address: userAddress, isConnected } = useAccount()

	const { user } = useContext(AppContext)

	if (!isConnected || userAddress === undefined) {
		return <SelectWalletView selectWallet={(wallet) => connect({ connector: connectors[0] })} />
	} else if (user === null) {
		return <RegistrationView />
	} else {
		return <ChatView />
	}
}

interface AppProps {}

export const App: React.FC<AppProps> = ({}) => {
	const [showStatusPanel, setShowStatusPanel] = useState(true)

	const [user, setUser] = useState<PrivateUserRegistration | null>(null)

	const [room, setRoom] = useState<Room | null>(null)

	// Stop and start the room manager in response to the user value
	const [manager, setManager] = useState<RoomManager | null>(null)

	const [peerId, setPeerId] = useState<PeerId | null>(null)
	useEffect(() => {
		getPeerId()
			.then((peerId) => setPeerId(peerId))
			.catch((err) => console.error(err))
	}, [])

	const managerRef = useRef<RoomManager | null>(null)
	const isManagerStarting = useRef<boolean>(false)
	const isManagerStopping = useRef<boolean>(false)

	useEffect(() => {
		if (peerId === null) {
			return
		}

		if (user === null) {
			if (managerRef.current !== null && !isManagerStopping.current) {
				isManagerStopping.current = true
				managerRef.current
					.stop()
					.then(() => setManager(null))
					.finally(() => {
						isManagerStopping.current = false
					})
			}
		} else {
			if (managerRef.current === null && !isManagerStarting.current) {
				isManagerStarting.current = true
				RoomManager.initialize(peerId, user)
					.then((manager) => setManager(manager))
					.finally(() => {
						isManagerStarting.current = false
					})
			}
		}
	}, [user, peerId])

	return (
		<AppContext.Provider value={{ peerId, manager, user, setUser, room, setRoom }}>
			<div className="w-screen h-screen flex flex-col items-stretch bg-white">
				<AppHeader showStatusPanel={showStatusPanel} setShowStatusPanel={setShowStatusPanel} />
				<div className="flex flex-row grow items-stretch overflow-y-hidden">
					<AppContent />
					{showStatusPanel && <StatusPanel />}
				</div>
			</div>
		</AppContext.Provider>
	)
}

interface AppHeaderProps {
	showStatusPanel: boolean
	setShowStatusPanel: (showStatusPanel: boolean) => void
}

const AppHeader: React.FC<AppHeaderProps> = ({ showStatusPanel, setShowStatusPanel }) => {
	const { disconnect } = useDisconnect()
	const { user, setUser, room } = useContext(AppContext)

	const logout = useCallback(() => {
		if (user !== null) {
			window.localStorage.removeItem(getRegistrationKey(user.address))
		}

		setUser(null)
		disconnect()
	}, [user, disconnect])

	const statusPanelIcon = showStatusPanel ? chevronRight : chevronLeft

	return (
		<div className="flex flex-row items-stretch border-gray-300 border-b">
			<h1 className="basis-64 grow-0 shrink-0 p-4 border-gray-300 border-r">Encrypted Chat</h1>
			<div className="flex flex-row grow items-center">
				<div className="grow p-4">{room && <RoomName room={room} />}</div>
				{user && (
					<button className="p-4 hover:bg-gray-100" onClick={logout}>
						Logout
					</button>
				)}
				<button className="p-4 hover:bg-gray-100" onClick={() => setShowStatusPanel(!showStatusPanel)}>
					{statusPanelIcon({ width: 24, height: 24 })}
				</button>
			</div>
		</div>
	)
}
