import React, { useCallback, useContext, useState } from "react"
import { Web3 } from "web3"

import { CosmosSigner } from "@canvas-js/chain-cosmos"

import { AppContext } from "../AppContext.js"

export interface ConnectCosmosEvmMetamaskProps {
	bech32Prefix: string
	chainId: string
}

export const ConnectCosmosEvmMetamask: React.FC<ConnectCosmosEvmMetamaskProps> = ({ bech32Prefix, chainId }) => {
	// The Cosmos EVM Metamask login method needs a `bech32Prefix` argument because we can't
	// infer the prefix from the chain (because we are using MetaMask to sign the messages, not a Cosmos wallet)
	const { sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)

	// true if this signing method is being used
	const [thisIsConnected, setThisIsConnected] = useState(false)

	const [error, setError] = useState<Error | null>(null)

	const connect = useCallback(async () => {
		if (!window.ethereum) {
			setError(new Error("window.ethereum not found"))
			return
		}

		let ethereum = window.ethereum as any
		if (ethereum.providers?.length) {
			ethereum.providers.forEach(async (p: any) => {
				if (p.isMetaMask) ethereum = p
			})
		}

		const web3 = new Web3(ethereum)
		await web3.eth.requestAccounts()
		const ethAccounts = await web3.eth.getAccounts()

		const thisAddress = ethAccounts[0]

		setAddress(thisAddress)
		setSessionSigner(
			new CosmosSigner({
				bech32Prefix,
				signer: {
					type: "ethereum",
					signEthereum: (chainId: string, signerAddress: string, message: string) =>
						web3.eth.personal.sign(message, signerAddress, ""),
					getAddress: async () => thisAddress,
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
