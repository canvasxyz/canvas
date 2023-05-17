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
	const { address, isConnected } = useAccount()

	const [registration, setRegistration] = useState<UserRegistration | null>(null)

	useLayoutEffect(() => {
		if (isConnected && address !== undefined && registration === null) {
			const key = getRegistrationKey(address)
			const value = window.localStorage.getItem(key)
			if (value !== null) {
				const registration = JSON.parse(value)
				console.log("got existing registration", registration)
				setRegistration(registration)
			}
		}
	}, [address, isConnected, registration])

	const handleSubmitPin = useCallback(
		async (pin: string) => {
			if (address === undefined) {
				return
			}

			try {
				const signature = await signMagicString(address, pin)
				const privateKey = keccak256(signature)
				const publicKeyBundle = makeKeyBundle(privateKey)
				const publicKeyBundleSignature = await signKeyBundle(address, publicKeyBundle)

				const registration: UserRegistration = {
					privateKey: toHex(privateKey),
					publicKeyBundle,
					publicKeyBundleSignature,
				}

				console.log("setting new registration", registration)
				const key = getRegistrationKey(address)
				window.localStorage.setItem(key, JSON.stringify(registration))

				setRegistration(registration)
			} catch (err) {
				console.error("failed to get signature", err)
			}
		},
		[address]
	)

	if (!isConnected || address === undefined) {
		return <SelectWalletView selectWallet={(wallet) => connect({ connector: connectors[0] })} />
	} else if (registration === null) {
		return <EnterPinView submitPin={handleSubmitPin} />
	} else {
		return <ChatView user={registration} />
	}
}
