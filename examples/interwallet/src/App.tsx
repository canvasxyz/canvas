import React, { useState, useContext, useEffect, useRef, useCallback } from "react"

import { PeerId } from "@libp2p/interface-peer-id"

import { ChatView } from "./views/ChatView"
import { RegistrationView } from "./views/RegistrationView"
import { SelectWalletView } from "./views/SelectWalletView"

import { PrivateUserRegistration, WalletName } from "./interfaces"
import { AppContext } from "./context"
import { RoomManager } from "./manager"
import { getPeerId } from "./libp2p"
import { Room, db } from "./db"
import { useWallet } from "./wallet"

export const App: React.FC<{}> = () => {
	const [user, setUser] = useState<PrivateUserRegistration | null>(null)
	const [room, setRoom] = useState<Room | null>(null)

	const setCurrentRoom = useCallback((room: Room | null) => {
		if (room === null) {
			location.hash = ""
		} else {
			location.hash = room.id
		}

		setRoom(room)
	}, [])

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
			const { hash } = window.location
			if (hash.startsWith("#")) {
				db.rooms.get(hash.slice(1)).then((room) => {
					if (room === undefined) {
						window.location.hash = ""
					} else {
						setRoom(room)
					}
				})
			}

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
		<AppContext.Provider value={{ user, setUser, room, setRoom: setCurrentRoom, manager, peerId }}>
			<AppContent />
		</AppContext.Provider>
	)
}

const AppContent: React.FC<{}> = ({}) => {
	const [walletName, setWalletName] = useState<WalletName | null>(null)
	const { disconnect, signKeyBundle, signMessage, userAddress } = useWallet({ walletName })

	const { user } = useContext(AppContext)

	if (userAddress === null) {
		return (
			<SelectWalletView
				selectWallet={async (wallet) => {
					if (wallet == "metamask") {
						setWalletName("metamask")
					} else if (wallet == "walletconnect") {
						setWalletName("walletconnect")
					} else {
						const _exhaustiveCheck: never = wallet
						throw new Error(`Unknown wallet: ${wallet}`)
					}
				}}
			/>
		)
	} else if (user === null) {
		if (walletName === null) {
			throw new Error("walletName is null")
		}
		return (
			<RegistrationView
				userAddress={userAddress}
				disconnect={disconnect}
				signKeyBundle={signKeyBundle}
				signMessage={signMessage}
				walletName={walletName}
			/>
		)
	} else {
		return <ChatView disconnect={disconnect} />
	}
}
