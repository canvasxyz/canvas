import React, { useCallback, useContext, useLayoutEffect } from "react"
import { useAccount, useDisconnect, useWalletClient } from "wagmi"

import { PrivateUserRegistration, createPrivateUserRegistration } from "../../shared/index.js"

import { getRegistrationKey } from "../utils.js"

export const RegistrationView = ({
	user,
	setUser,
}: {
	user: PrivateUserRegistration | null
	setUser: (user: PrivateUserRegistration) => void
}) => {
	const { address: userAddress, isConnected } = useAccount()
	const { data: walletClient } = useWalletClient()

	const [pin, setPin] = React.useState("")
	const { disconnect } = useDisconnect()

	useLayoutEffect(() => {
		if (isConnected && userAddress !== undefined && user === null) {
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
	}, [userAddress, isConnected, user])

	const handleSubmitPin = useCallback(
		async (pin: string) => {
			if (userAddress === undefined || !walletClient) {
				return
			}
			try {
				const user = await createPrivateUserRegistration(walletClient, userAddress, pin)
				console.log("setting new registration", user)
				const key = getRegistrationKey(userAddress)
				window.localStorage.setItem(key, JSON.stringify(user))
				setUser(user)
			} catch (err) {
				console.error("failed to get signature", err)
			}
		},
		[userAddress, walletClient]
	)

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
