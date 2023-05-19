import React, { useLayoutEffect, useState, useCallback } from "react"

import { useAccount, useConnect } from "wagmi"
import { keccak256, toHex } from "viem/utils"

import { ChatView } from "./views/ChatView"
import { EnterPinView } from "./views/EnterPinView"
import { SelectWalletView } from "./views/SelectWalletView"
import { makeKeyBundle, signKeyBundle, signMagicString } from "./cryptography"
import { UserRegistration } from "./interfaces"

const getRegistrationKey = (address: string) => `interwallet:registration:${address}`

export const App: React.FC<{}> = ({}) => {
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
		return <ChatView userAddress={userAddress} userRegistration={userRegistration} />
	}
}
