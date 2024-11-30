import React, { useCallback, useContext, useState } from "react"
import { CosmosSigner } from "@canvas-js/chain-cosmos"
import { fromBech32, toBase64 } from "@cosmjs/encoding"

import { AppContext } from "../AppContext.js"

export interface ConnectTerraProps {}

declare global {
	interface Window {
		station?: any
	}
}

export const ConnectTerra: React.FC<ConnectTerraProps> = ({}) => {
	const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)

	// true if this signing method is being used
	const [thisIsConnected, setThisIsConnected] = useState(false)

	const [error, setError] = useState<Error | null>(null)

	const connect = useCallback(async () => {
		const accountData = await window.station.connect()

		if (!accountData) {
			setError(new Error("address not found"))
			return
		}

		const accountAddr = accountData?.address
		const { prefix: bech32Prefix } = fromBech32(accountAddr)
		setAddress(accountAddr)
		setSessionSigner(
			new CosmosSigner({
				bech32Prefix,
				signer: {
					type: "bytes",
					getAddress: async () => accountData.address,
					getChainId: async () => accountData.network,
					signBytes: (message) => window.station.signBytes(toBase64(message)),
				},
			}),
		)
		setThisIsConnected(true)
	}, [address])

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
				className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
				onClick={() => disconnect()}
			>
				Disconnect Terra wallet
			</button>
		)
	} else {
		return (
			<button
				className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
				onClick={() => connect()}
			>
				Connect Terra wallet
			</button>
		)
	}
}
