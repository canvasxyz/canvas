import React, { useCallback, useContext, useState } from "react"

import { CosmosSigner } from "@canvas-js/chain-cosmos"

import { AppContext } from "../AppContext.js"

export interface ConnectLeapProps {
	chainId: string
}

declare global {
	interface Window {
		leap?: any
	}
}

export const ConnectLeap: React.FC<ConnectLeapProps> = ({ chainId }) => {
	const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)

	// true if this signing method is being used
	const [thisIsConnected, setThisIsConnected] = useState(false)

	const [error, setError] = useState<Error | null>(null)

	const connect = useCallback(async () => {
		const leap = window.leap
		if (!leap) {
			setError(new Error("window.leap not found"))
			return
		}

		await leap.enable(chainId)

		const key = await leap.getKey(chainId)

		setAddress(key.bech32Address)

		setSessionSigner(
			new CosmosSigner({
				signer: {
					type: "arbitrary",
					signArbitrary: (msg) => leap.signArbitrary(chainId, key.bech32Address, msg),
					getAddress: async () => key.bech32Address,
					getChainId: async () => chainId,
				},
			}),
		)
		console.log("5")
		setThisIsConnected(true)
		console.log("6")
	}, [])

	const disconnect = useCallback(async () => {
		setAddress(null)
		setSessionSigner(null)
		setThisIsConnected(false)
	}, [sessionSigner])

	if (error !== null) {
		return (
			<div className="p-2 border rounded bg-red-100 text-sm">
				<code>{error.message}</code>
			</div>
		)
	} else if (address !== null && thisIsConnected) {
		return (
			<button
				onClick={() => disconnect()}
				className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
			>
				Disconnect Leap wallet
			</button>
		)
	} else {
		return (
			<button
				onClick={() => connect()}
				className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
			>
				Connect Leap wallet
			</button>
		)
	}
}
