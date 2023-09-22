import React, { useCallback, useContext, useEffect, useRef, useState } from "react"
import { Eip1193Provider, BrowserProvider, EventEmitterable } from "ethers"

import { SIWESigner } from "@canvas-js/chain-ethereum"

import { AppContext } from "./AppContext.js"
import { sessionStore } from "./utils.js"

declare global {
	// eslint-disable-next-line no-var
	var ethereum: undefined | null | (Eip1193Provider & EventEmitterable<"accountsChanged" | "chainChanged">)
}

export interface ConnectProps {}

export const Connect: React.FC<ConnectProps> = ({}) => {
	const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)

	const [provider, setProvider] = useState<BrowserProvider | null>(null)
	const [error, setError] = useState<Error | null>(null)
	const initialRef = useRef(false)

	const connect = useCallback(async () => {
		if (window.ethereum === undefined || window.ethereum === null) {
			setError(new Error("window.ethereum not found"))
			return
		}

		const provider = new BrowserProvider(window.ethereum)

		const signer = await provider.getSigner()
		const address = await signer.getAddress()
		setProvider(provider)
		setAddress(address)
		setSessionSigner(new SIWESigner({ signer, store: sessionStore }))
	}, [])

	useEffect(() => {
		if (initialRef.current) {
			return
		}

		initialRef.current = true

		// TODO: handle these more gracefully
		window.ethereum?.on("chainChanged", (chainId) => window.location.reload())
		window.ethereum?.on("accountsChanged", (accounts) => window.location.reload())

		connect()
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
	} else if (address === null) {
		return (
			<div className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200">
				<button onClick={() => connect()}>Connect</button>
			</div>
		)
	} else {
		return (
			<div className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200">
				<button onClick={() => disconnect()}>Disconnect</button>
			</div>
		)
	}
}
