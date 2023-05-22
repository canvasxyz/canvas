import React, { useLayoutEffect, useState, useCallback, useContext } from "react"

import { useAccount, useConnect } from "wagmi"
import { keccak256, toHex } from "viem/utils"

import { ChatView } from "./views/ChatView"
import { EnterPinView } from "./views/EnterPinView"
import { SelectWalletView } from "./views/SelectWalletView"
import { UserRegistration } from "./interfaces"
import { makeKeyBundle, signKeyBundle, signMagicString } from "./cryptography"
import { AppContext } from "./context"

import chevronRight from "./icons/chevron-right.svg"
import chevronLeft from "./icons/chevron-left.svg"
import { StatusPanel } from "./views/StatusPanel"

const getRegistrationKey = (address: string) => `interwallet:registration:${address}`

const AppContent: React.FC<{}> = ({}) => {
	const { connect, connectors } = useConnect()
	const { address: userAddress, isConnected } = useAccount()

	const [userRegistration, setUserRegistration] = useState<UserRegistration | null>(null)

	useLayoutEffect(() => {
		if (isConnected && userAddress !== undefined && userRegistration === null) {
			const key = getRegistrationKey(userAddress)
			const value = window.localStorage.getItem(key)
			if (value !== null) {
				const registration = JSON.parse(value)
				console.log("got existing registration", registration)
				setUserRegistration(registration)
			}
		}
	}, [userAddress, isConnected, userRegistration])

	const handleSubmitPin = useCallback(
		async (pin: string) => {
			if (userAddress === undefined) {
				return
			}

			try {
				const signature = await signMagicString(userAddress, pin)
				const privateKey = keccak256(signature)
				const publicKeyBundle = makeKeyBundle(privateKey)
				const publicKeyBundleSignature = await signKeyBundle(userAddress, publicKeyBundle)

				const registration: UserRegistration = {
					privateKey: toHex(privateKey),
					publicKeyBundle,
					publicKeyBundleSignature,
				}

				console.log("setting new registration", registration)
				const key = getRegistrationKey(userAddress)
				window.localStorage.setItem(key, JSON.stringify(registration))

				setUserRegistration(registration)
			} catch (err) {
				console.error("failed to get signature", err)
			}
		},
		[userAddress]
	)

	if (!isConnected || userAddress === undefined) {
		return <SelectWalletView selectWallet={(wallet) => connect({ connector: connectors[0] })} />
	} else if (userRegistration === null) {
		return <EnterPinView submitPin={handleSubmitPin} />
	} else {
		return <ChatView />
	}
}

interface AppProps {}

export const App: React.FC<AppProps> = (props) => {
	const [showStatusPanel, setShowStatusPanel] = useState(false)
	const statusPanelIcon = showStatusPanel ? chevronRight : chevronLeft

	const [pageTitle, setPageTitle] = useState<string | null>(null)

	return (
		<AppContext.Provider value={{ pageTitle, setPageTitle }}>
			<div className="w-screen h-screen flex flex-col items-stretch bg-white">
				<div className="flex flex-row items-stretch border-gray-300 border-b">
					<h1 className="basis-64 grow-0 shrink-0 p-4 border-gray-300 border-r">Encrypted Chat</h1>
					<div className="flex flex-row grow items-center justify-end">
						{pageTitle && <h2 className="p-3 grow font-bold text-lg">{pageTitle}</h2>}
						<button className="p-3" onClick={() => setShowStatusPanel(!showStatusPanel)}>
							{statusPanelIcon({ width: 24, height: 24 })}
						</button>
					</div>
				</div>
				<div className="flex flex-row grow items-stretch overflow-y-hidden">
					<AppContent />
					{showStatusPanel && <StatusPanel />}
				</div>
			</div>
		</AppContext.Provider>
	)
}
