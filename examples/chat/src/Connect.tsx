import React, { useCallback, useContext, useEffect, useRef, useState } from "react"
import { Eip1193Provider, BrowserProvider, EventEmitterable } from "ethers"

import { SIWESigner } from "@canvas-js/chain-ethereum"

import { AppContext } from "./AppContext.js"
import { sessionStore } from "./utils.js"

declare global {
	var ethereum: undefined | null | (Eip1193Provider & EventEmitterable<"accountsChanged" | "chainChanged">)
}

export interface ConnectProps {}

export const Connect: React.FC<ConnectProps> = ({}) => {
	const { signer, setSigner, setAddress } = useContext(AppContext)

	const [provider, setProvider] = useState<BrowserProvider | null>(null)
	const [error, setError] = useState<Error | null>(null)
	const initialRef = useRef(false)

	const connect = useCallback(async (provider: BrowserProvider, address?: string) => {
		try {
			const signer = await provider.getSigner(address)
			setAddress(await signer.getAddress())
			setSigner(new SIWESigner({ signer, store: sessionStore }))
		} catch (err) {
			console.error(err)
		}
	}, [])

	useEffect(() => {
		if (initialRef.current) {
			return
		}

		initialRef.current = true

		if (window.ethereum !== undefined && window.ethereum !== null) {
			const provider = new BrowserProvider(window.ethereum)
			setProvider(provider)
			connect(provider)
			window.ethereum.on("chainChanged", (chainId) => window.location.reload())
			window.ethereum.on("accountsChanged", (...args) => {
				console.log("accountsChanged", ...args)
			})
		} else {
			setError(new Error("window.ethereum not found"))
		}
	}, [])

	const disconnect = useCallback(async () => {
		setSigner(null)
	}, [provider])

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
	} else if (signer === null) {
		return (
			<div className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200">
				<button onClick={() => connect(provider)}>Connect</button>
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
