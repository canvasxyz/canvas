import React, { useState } from "react"

import { useAccount, useConnect } from "wagmi"

import { PrivateUserRegistration } from "../shared/index.js"

import { LoggedInView } from "./views/ChatView.js"
import { RegistrationView } from "./views/RegistrationView.js"
import { SelectWalletView } from "./views/SelectWalletView.js"

export const App: React.FC<{}> = ({}) => {
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
