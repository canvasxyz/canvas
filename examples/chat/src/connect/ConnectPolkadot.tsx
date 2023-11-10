import React, { useCallback, useContext, useState } from "react"
import { web3Enable, web3Accounts, web3FromAddress } from "@polkadot/extension-dapp"

import { SubstrateSigner } from "@canvas-js/chain-substrate"

import { AppContext } from "../AppContext.js"

export interface ConnectPolkadotProps {}

export const ConnectPolkadot: React.FC<ConnectPolkadotProps> = ({}) => {
	const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)

	const [error, setError] = useState<Error | null>(null)

	const connect = useCallback(async () => {
		await web3Enable("canvas-chat")
		const accounts = await web3Accounts()
		const address = accounts[0].address
		const chainId = accounts[0].meta.genesisHash?.substring(2, 34)
		const extension = await web3FromAddress(address)

		setAddress(`polkadot:${chainId}:${address}`)
		setSessionSigner(new SubstrateSigner({ extension }))
	}, [])

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
	} else if (address !== null && sessionSigner instanceof SubstrateSigner) {
		return (
			<button
				onClick={() => disconnect()}
				className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
			>
				Disconnect Polkadot wallet
			</button>
		)
	} else {
		return (
			<button
				onClick={() => connect()}
				className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
			>
				Connect Polkadot wallet
			</button>
		)
	}
}
