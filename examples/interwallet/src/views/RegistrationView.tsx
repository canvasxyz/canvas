import React, { useCallback, useContext, useLayoutEffect } from "react"

import { AppContext } from "../context"
import { buildMagicString, getRegistrationKey, makeKeyBundle } from "../cryptography"
import { KeyBundle, WalletName } from "../interfaces"
import { getAddress, keccak256 } from "viem"

export const RegistrationView = ({
	userAddress,
	walletName,
	disconnect,
	signMessage,
	signKeyBundle,
}: {
	userAddress: string
	walletName: WalletName
	disconnect: () => void
	signMessage: (message: string) => Promise<`0x${string}`>
	signKeyBundle: (keyBundle: KeyBundle) => Promise<`0x${string}`>
}) => {
	const { user, setUser } = useContext(AppContext)

	const [pin, setPin] = React.useState("")

	useLayoutEffect(() => {
		if (user === null) {
			const key = getRegistrationKey(userAddress)
			const value = window.localStorage.getItem(key)
			if (value !== null) {
				const user = JSON.parse(value)
				if (typeof user.address === "string") {
					console.log("got existing registration", user)
					setUser(user)
				}
			}
		}
	}, [user])

	const handleSubmitPin = async (pin: string) => {
		try {
			const magicString = buildMagicString(pin)

			const signature = await signMessage(magicString)

			const privateKey = keccak256(signature)
			const keyBundle = makeKeyBundle(privateKey)
			const keyBundleSignature = await signKeyBundle(keyBundle)

			const user = {
				address: getAddress(userAddress),
				privateKey,
				keyBundle,
				keyBundleSignature,
				walletName,
			}
			console.log("setting new registration", user)
			const key = getRegistrationKey(userAddress)
			window.localStorage.setItem(key, JSON.stringify(user))
			setUser(user)
		} catch (err) {
			console.error("failed to get signature", err)
		}
	}

	const goBack = useCallback(() => {
		if (user !== null) {
			window.localStorage.removeItem(getRegistrationKey(user.address))
		}

		setUser(null)
		disconnect()
	}, [user, disconnect])

	return (
		<div className="flex flex-row grow items-center justify-center h-screen overflow-hidden bg-gray-50">
			<div className="container max-w-lg m-auto p-4 flex flex-col gap-4">
				<div className="text-2xl font-bold">Enter PIN</div>
				<form
					className="flex flex-row gap-3 items-center"
					onSubmit={(e) => {
						e.preventDefault()
						handleSubmitPin(pin)
					}}
				>
					<input
						className="h-10 w-full border border-black bg-white focus:outline-none pl-2"
						placeholder="XXXX"
						value={pin}
						onChange={(e) => setPin(e.target.value)}
					></input>
					<button
						type="submit"
						className="p-2 rounded-md bg-blue-500 hover:bg-blue-700 hover:cursor-pointer select-none text-white text-center"
					>
						Submit
					</button>
				</form>
				<button
					className="p-2 rounded-md bg-red-500 hover:bg-red-700 hover:cursor-pointer select-none text-white text-center"
					onClick={goBack}
				>
					Back
				</button>
			</div>
		</div>
	)
}
