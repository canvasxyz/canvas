import React, { useCallback, useEffect, useState } from "react"

import { useAccount, useConnect } from "wagmi"

import { PrivateUserRegistration } from "../shared/index.js"

import { LoggedInView } from "./views/ChatView.js"
import { RegistrationView } from "./views/RegistrationView.js"
import { SelectWalletView } from "./views/SelectWalletView.js"
import { SelectedRoomIdContext } from "./SelectedRoomIdContext.js"

export const App: React.FC<{}> = ({}) => {
	const { connect, connectors } = useConnect()
	const { address: userAddress, isConnected } = useAccount()

	const [user, setUser] = useState<PrivateUserRegistration | null>(null)

	const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)

	const setCurrentRoom = useCallback((roomId: string | null) => {
		if (roomId === null) {
			location.hash = ""
		} else {
			location.hash = roomId
		}

		setSelectedRoomId(roomId)
	}, [])

	useEffect(() => {
		const { hash } = window.location
		if (hash.startsWith("#")) {
			const roomId = hash.slice(1)
			if (roomId) {
				setSelectedRoomId(roomId)
			}
		}
	}, [])

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
		return (
			<SelectedRoomIdContext.Provider value={{ selectedRoomId, setSelectedRoomId: setCurrentRoom }}>
				<LoggedInView user={user} setUser={setUser} />
			</SelectedRoomIdContext.Provider>
		)
	}
}
