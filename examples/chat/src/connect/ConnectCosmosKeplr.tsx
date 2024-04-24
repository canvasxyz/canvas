import React, { useCallback, useContext, useState } from "react"
import type { Window as KeplrWindow } from "@keplr-wallet/types"

import { CosmosSigner } from "@canvas-js/chain-cosmos"

import { AppContext } from "../AppContext.js"

declare global {
	// eslint-disable-next-line @typescript-eslint/no-empty-interface
	interface Window extends KeplrWindow {}
}

export interface ConnectCosmosKeplrProps {
	bech32Prefix: string
	chainId: string
}

export const ConnectCosmosKeplr: React.FC<ConnectCosmosKeplrProps> = ({ bech32Prefix, chainId }) => {
	const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)

	// true if this signing method is being used
	const [thisIsConnected, setThisIsConnected] = useState(false)

	const [error, setError] = useState<Error | null>(null)

	const connect = useCallback(async () => {
		const keplr = window.keplr
		if (!keplr) {
			setError(new Error("window.keplr not found"))
			return
		}

		await keplr.enable(chainId)
		const offlineSigner = await keplr.getOfflineSignerAuto(chainId)
		const accounts = await offlineSigner.getAccounts()
		const address = accounts[0].address

		setAddress(address)
		setSessionSigner(
			new CosmosSigner({
				bech32Prefix,
				signer: {
					type: "amino",
					signAmino: async (chainId, signer, signDoc) => {
						console.log("signAmino", chainId, signer, signDoc)
						return keplr.signAmino(chainId, signer, signDoc)
					},
					getAddress: async () => address,
					getChainId: async () => chainId,
				},
			}),
		)
		setThisIsConnected(true)
	}, [bech32Prefix, chainId])

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
				Disconnect Keplr (Cosmos) wallet
			</button>
		)
	} else {
		return (
			<button
				onClick={() => connect()}
				className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
			>
				Connect Keplr (Cosmos) wallet
			</button>
		)
	}
}
