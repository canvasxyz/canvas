import React, { useState, useContext, useEffect, useRef, useCallback, useMemo } from "react"

import { useAccount, useConnect } from "wagmi"
import { PeerId } from "@libp2p/interface-peer-id"

import { Room, PrivateUserRegistration } from "../shared/index.js"

import { ChatView } from "./views/ChatView.js"
import { RegistrationView } from "./views/RegistrationView.js"
import { SelectWalletView } from "./views/SelectWalletView.js"

import { RoomManager } from "./manager.js"
import { getPeerId } from "./libp2p.js"
import { db } from "./db.js"
import { useLibp2p } from "./useLibp2p.js"

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

	const isManagerStarting = useRef<boolean>(false)
	const isManagerStopping = useRef<boolean>(false)

	useEffect(() => {
		if (peerId === null) {
			return
		}

		if (user === null) {
			if (manager !== null && !isManagerStopping.current) {
				isManagerStopping.current = true
				;(async () => {
					await manager.stop()
					await Promise.all(db.tables.map((table) => table.clear()))
					await manager.destroyTables()
					setManager(null)
				})().finally(() => {
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

			if (manager === null && !isManagerStarting.current) {
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
		// <AppContext.Provider value={{ user, setUser, room, setRoom: setCurrentRoom, manager, peerId }}>
		<AppContent />
		// </AppContext.Provider>
	)
}

const LoggedInView = ({
	user,
	setUser,
}: {
	user: PrivateUserRegistration
	setUser: (user: PrivateUserRegistration | null) => void
}) => {
	const { libp2p } = useLibp2p()
	console.log("libp2p:", libp2p)

	return libp2p === null ? "Loading..." : <ChatView libp2p={libp2p} user={user} setUser={setUser} />
}

const AppContent: React.FC<{}> = ({}) => {
	const { connect, connectors } = useConnect()
	const { address: userAddress, isConnected } = useAccount()

	const [user, setUser] = useState<PrivateUserRegistration | null>(null)

	if (!isConnected || userAddress === undefined) {
		return (
			<SelectWalletView
				selectWallet={async (wallet) => {
					if (wallet == "metamask") {
						connect({ connector: connectors[0] })
					} else if (wallet == "walletconnect") {
						connect({ connector: connectors[1] })
					}
				}}
			/>
		)
	} else if (user === null) {
		return <RegistrationView user={user} setUser={setUser} />
	} else {
		return <LoggedInView user={user} setUser={setUser} />
	}
}
