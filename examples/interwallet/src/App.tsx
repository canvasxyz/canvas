import React, { useState, useContext, useEffect, useRef } from "react"

import { useAccount, useConnect } from "wagmi"
import { PeerId } from "@libp2p/interface-peer-id"

import { ChatView } from "./views/ChatView"
import { RegistrationView } from "./views/RegistrationView"
import { SelectWalletView } from "./views/SelectWalletView"

import { PrivateUserRegistration } from "./interfaces"
import { AppContext } from "./context"
import { RoomManager } from "./manager"
import { getPeerId } from "./libp2p"
import { Room } from "./db"

export const App: React.FC<{}> = () => {
	const [user, setUser] = useState<PrivateUserRegistration | null>(null)
	const [room, setRoom] = useState<Room | null>(null)

	const [peerId, setPeerId] = useState<PeerId | null>(null)
	useEffect(() => {
		getPeerId()
			.then((peerId) => setPeerId(peerId))
			.catch((err) => console.error(err))
	}, [])

	const [manager, setManager] = useState<RoomManager | null>(null)

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
		<AppContext.Provider value={{ user, setUser, room, setRoom, manager, peerId }}>
			<AppContent />
		</AppContext.Provider>
	)
}

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
