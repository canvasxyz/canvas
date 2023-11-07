import React, { useCallback, useContext, useEffect, useRef, useState } from "react"
import { Eip1193Provider, BrowserProvider, EventEmitterable } from "ethers"

import { CosmosSigner } from "@canvas-js/chain-cosmos"

import { AppContext } from "./AppContext.js"
import { sessionStore } from "./utils.js"

declare global {
	// eslint-disable-next-line no-var
	var ethereum: undefined | null | (Eip1193Provider & EventEmitterable<"accountsChanged" | "chainChanged">)
}

export interface ConnectCosmosEvmMetamaskProps {
	chainId: string
}

export const ConnectCosmosEvmMetamask: React.FC<ConnectCosmosEvmMetamaskProps> = ({ chainId }) => {
	const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)

	// true if this signing method is being used
	const [thisIsConnected, setThisIsConnected] = useState(false)
	const [provider, setProvider] = useState<BrowserProvider | null>(null)

	const [error, setError] = useState<Error | null>(null)

	const connect = useCallback(async () => {
		if (!provider) {
			setError(new Error("window.ethereum not found"))
			return
		}

		const signer = await provider.getSigner()
		const address = await signer.getAddress()
		setProvider(provider)
		setAddress(address)

		setSessionSigner(
			new CosmosSigner({
				signer: {
					type: "siwe",
					signSIWE: signer.signMessage,
					getAddress: signer.getAddress,
				},
				store: sessionStore,
			})
		)
		setThisIsConnected(true)
	}, [provider])

	const initialRef = useRef(false)
	useEffect(() => {
		if (initialRef.current) {
			return
		}

		initialRef.current = true

		if (window.ethereum === undefined || window.ethereum === null) {
			setError(new Error("window.ethereum not found"))
			return
		}

		// TODO: handle these more gracefully
		window.ethereum.on("chainChanged", (chainId) => window.location.reload())
		window.ethereum.on("accountsChanged", (accounts) => window.location.reload())

		const provider = new BrowserProvider(window.ethereum)
		setProvider(provider)
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
			<div className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200">
				<button onClick={() => disconnect()}>Disconnect Cosmos EVM Metamask wallet</button>
			</div>
		)
	} else if (address === null) {
		return (
			<div className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200">
				<button onClick={() => connect()}>Connect Cosmos EVM Metamask wallet</button>
			</div>
		)
	} else {
		return (
			<div className="p-2 border rounded bg-gray-100 text-gray-600">
				<button disabled>Connect Cosmos EVM Metamask wallet</button>
			</div>
		)
	}
}
