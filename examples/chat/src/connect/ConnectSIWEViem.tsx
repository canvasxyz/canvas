import React, { useCallback, useContext, useState } from "react"

import { SIWESignerViem } from "@canvas-js/chain-ethereum-viem"

import { AppContext } from "../AppContext.js"
import { createWalletClient, custom } from "viem"
import { mainnet } from "viem/chains"

export interface ConnectSIWEViemProps {}

export const ConnectSIWEViem: React.FC<ConnectSIWEViemProps> = ({}) => {
	const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)

	const [error, setError] = useState<Error | null>(null)

	const connect = useCallback(async () => {
		if (app === null) {
			setError(new Error("app not initialized"))
			return
		}

		const client = createWalletClient({
			chain: mainnet,
			transport: custom(window.ethereum as any),
		})

		const chainId = await client.getChainId()
		await client.requestAddresses()
		const signer = new SIWESignerViem({ signer: client, chainId })

		const [{ address }] = await signer.newSession(app.topic)
		setAddress(address)
		setSessionSigner(signer)
	}, [app])

	const disconnect = useCallback(async () => {
		setAddress(null)
		setSessionSigner(null)
	}, [sessionSigner])

	if (error !== null) {
		return (
			<div className="p-2 border rounded bg-red-100 text-sm">
				<code>{error.message}</code>
			</div>
		)
	} else if (address !== null && sessionSigner instanceof SIWESignerViem) {
		return (
			<button
				onClick={() => disconnect()}
				className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
			>
				Disconnect ETH wallet (Viem)
			</button>
		)
	} else {
		return (
			<button
				onClick={() => connect()}
				className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
			>
				Connect ETH wallet (Viem)
			</button>
		)
	}
}
