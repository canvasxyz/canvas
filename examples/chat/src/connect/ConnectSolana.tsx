declare let window: any
import React, { useCallback, useContext, useState } from "react"

import { SolanaSigner } from "@canvas-js/chain-solana"

import { AppContext } from "../AppContext.js"

export interface ConnectSolanaProps {}

const getProvider = () => {
	if ("phantom" in window) {
		const provider = window.phantom?.solana

		if (provider?.isPhantom) {
			return provider
		}
	}
}

export const ConnectSolana: React.FC<ConnectSolanaProps> = ({}) => {
	const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)

	const [error, setError] = useState<Error | null>(null)
	const [provider, setProvider] = useState<any | null>(null)

	const connect = useCallback(async () => {
		const connectResponse = await window.solana.connect()
		const publicKey =
			typeof connectResponse.publicKey === "function"
				? (await connectResponse.publicKey()).toString()
				: connectResponse.publicKey.toString()

		const chainId = "mainnet"
		setAddress(`solana:${chainId}:${publicKey}`)
		const provider = getProvider()
		setSessionSigner(new SolanaSigner({ signer: provider }))
	}, [provider])

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
	}

	if (address !== null && sessionSigner instanceof SolanaSigner) {
		// is logged in
		return (
			<div className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200">
				<button onClick={() => disconnect()}>Disconnect Solana wallet</button>
			</div>
		)
	}

	const solanaIsAvailable = "solana" in window

	// is not logged in
	if (solanaIsAvailable) {
		return (
			<div className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200">
				<button onClick={() => connect()}>Connect Solana wallet</button>
			</div>
		)
	} else {
		return (
			<div className="p-2 border rounded bg-gray-100 text-gray-600">
				<button disabled>Connect Solana wallet</button>
			</div>
		)
	}
}
