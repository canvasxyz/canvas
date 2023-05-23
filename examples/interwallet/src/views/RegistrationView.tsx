import React, { useCallback, useContext, useLayoutEffect } from "react"
import { useAccount } from "wagmi"
import { hexToBytes, keccak256 } from "viem/utils"

import Events from "#protocols/events"

import { AppContext } from "../context"
import { PrivateUserRegistration } from "../interfaces"
import { getRegistrationKey, makeKeyBundle, signKeyBundle, signMagicString } from "../cryptography"
import { libp2p } from "../stores/libp2p"
import { ROOM_REGISTRY_TOPIC, USER_REGISTRY_TOPIC } from "../constants"

export interface RegistrationViewProps {}

export const RegistrationView: React.FC<RegistrationViewProps> = (props) => {
	const { address: userAddress, isConnected } = useAccount()

	const { user, setUser } = useContext(AppContext)

	const [pin, setPin] = React.useState("")

	useLayoutEffect(() => {
		if (isConnected && userAddress !== undefined && user === null) {
			const key = getRegistrationKey(userAddress)
			const value = window.localStorage.getItem(key)
			if (value !== null) {
				const registration = JSON.parse(value)
				console.log("got existing registration", registration)
				setUser(registration)
			}
		}
	}, [userAddress, isConnected, user])

	const handleSubmitPin = useCallback(
		async (pin: string) => {
			if (userAddress === undefined) {
				return
			}

			try {
				const signature = await signMagicString(userAddress, pin)
				const privateKey = keccak256(signature)
				const keyBundle = makeKeyBundle(privateKey)
				const keyBundleSignature = await signKeyBundle(userAddress, keyBundle)

				const value = Events.SignedKeyBundle.encode({
					signature: hexToBytes(signature),
					signingAddress: hexToBytes(keyBundle.signingAddress),
					encryptionPublicKey: hexToBytes(keyBundle.encryptionPublicKey),
				}).finish()

				await libp2p.services[USER_REGISTRY_TOPIC].insert(hexToBytes(userAddress), value)

				const registration: PrivateUserRegistration = {
					privateKey,
					keyBundle,
					keyBundleSignature,
				}

				console.log("setting new registration", registration)
				const key = getRegistrationKey(userAddress)
				window.localStorage.setItem(key, JSON.stringify(registration))

				setUser(registration)
			} catch (err) {
				console.error("failed to get signature", err)
			}
		},
		[userAddress]
	)

	return (
		<div className="flex flex-row grow items-center justify-center h-screen overflow-hidden bg-gray-50">
			<div className="container max-w-lg m-auto p-4 flex flex-col gap-4">
				<div className="text-2xl font-bold">Enter PIN</div>
				<div className="flex flex-row gap-3 items-center">
					<input
						className="h-10 w-full border border-black bg-white focus:outline-none pl-2"
						placeholder="XXXX"
						value={pin}
						onChange={(e) => setPin(e.target.value)}
					></input>
					<button
						className="p-2 rounded-md bg-blue-500 hover:bg-blue-700 hover:cursor-pointer select-none text-white text-center"
						onClick={() => handleSubmitPin(pin)}
					>
						Submit
					</button>
				</div>
			</div>
		</div>
	)
}
