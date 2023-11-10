import React, { useCallback, useContext, useEffect, useRef, useState } from "react"
import { Web3 } from "web3"
import { MetaMaskInpageProvider } from "@metamask/providers"

import { CosmosSigner } from "@canvas-js/chain-cosmos"

import { AppContext } from "../AppContext.js"

declare global {
	interface Window {
		ethereum: MetaMaskInpageProvider
	}
}

export interface ConnectCosmosEvmMetamaskProps {
	chainId: string
}

export const ConnectCosmosEvmMetamask: React.FC<ConnectCosmosEvmMetamaskProps> = ({ chainId }) => {
	const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)

	// true if this signing method is being used
	const [thisIsConnected, setThisIsConnected] = useState(false)

	const [error, setError] = useState<Error | null>(null)

	const connect = useCallback(async () => {
		if (!window.ethereum) {
			setError(new Error("window.ethereum not found"))
			return
		}

		const web3 = new Web3(window.ethereum)
		await web3.eth.requestAccounts()
		const ethAccounts = await web3.eth.getAccounts()

		const thisAddress = ethAccounts[0]

		setAddress(thisAddress)
		setSessionSigner(
			new CosmosSigner({
				signer: {
					type: "ethereum",
					signEthereum: (chainId: string, signerAddress: string, message: string) =>
						web3.eth.personal.sign(message, signerAddress, ""),
					getAddress: async () => thisAddress,
					getChainId: async () => chainId,
				},
			})
		)
		setThisIsConnected(true)
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
				Disconnect Cosmos/EVM Metamask wallet
			</button>
		)
	} else {
		return (
			<button
				onClick={() => connect()}
				className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
			>
				Connect Cosmos/EVM Metamask wallet
			</button>
		)
	}
}
