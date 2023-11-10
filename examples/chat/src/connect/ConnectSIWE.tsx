import React, { useCallback, useContext, useEffect, useRef, useState } from "react"
import { Eip1193Provider, BrowserProvider, EventEmitterable } from "ethers"

import { SIWESigner } from "@canvas-js/chain-ethereum"

import { AppContext } from "../AppContext.js"

declare global {
	// eslint-disable-next-line no-var
	var ethereum: undefined | null | (Eip1193Provider & EventEmitterable<"accountsChanged" | "chainChanged">)
}

export interface ConnectSIWEProps {}

export const ConnectSIWE: React.FC<ConnectSIWEProps> = ({}) => {
	const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)

	const [provider, setProvider] = useState<BrowserProvider | null>(null)
	const [error, setError] = useState<Error | null>(null)

	const connect = useCallback(async () => {
		if (app === null) {
			setError(new Error("app not initialized"))
			return
		}

		if (provider === null) {
			setError(new Error("window.ethereum not found"))
			return
		}

		setProvider(provider)

		const network = await provider.getNetwork()
		const signer = await provider
			.getSigner()
			.then((signer) => new SIWESigner({ signer, chainId: Number(network.chainId) }))

		const { address } = await signer.getSession(app.topic)
		setAddress(address)
		setSessionSigner(signer)
	}, [app, provider])

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
	}, [sessionSigner])

	if (error !== null) {
		return (
			<div className="p-2 border rounded bg-red-100 text-sm">
				<code>{error.message}</code>
			</div>
		)
	} else if (provider === null) {
		return (
			<div className="p-2 border rounded bg-gray-200">
				<button disabled>Loading...</button>
			</div>
		)
	} else if (address !== null && sessionSigner instanceof SIWESigner) {
		return (
			<button
				onClick={() => disconnect()}
				className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
			>
				Disconnect ETH wallet
			</button>
		)
	} else {
		return (
			<button
				onClick={() => connect()}
				className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
			>
				Connect ETH wallet
			</button>
		)
	}
}
