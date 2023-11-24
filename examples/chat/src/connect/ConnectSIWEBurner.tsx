import React, { useCallback, useContext, useEffect, useRef, useState } from "react"
import { Eip1193Provider, BrowserProvider, EventEmitterable } from "ethers"

import { SIWESigner } from "@canvas-js/chain-ethereum"

import { AppContext } from "../AppContext.js"

declare global {
	// eslint-disable-next-line no-var
	var ethereum: undefined | null | (Eip1193Provider & EventEmitterable<"accountsChanged" | "chainChanged">)
}

export interface ConnectSIWEBurnerProps {}

export const ConnectSIWEBurner: React.FC<ConnectSIWEBurnerProps> = ({}) => {
	const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)

	const [provider, setProvider] = useState<BrowserProvider | null>(null)
	const [error, setError] = useState<Error | null>(null)

	const connect = useCallback(async () => {
		if (app === null) {
			setError(new Error("app not initialized"))
			return
		}

		const signer = new SIWESigner({ chainId: 1 })
		const { address } = await signer.getSession(app.topic)
		setAddress(address)
		setSessionSigner(signer)
	}, [app, provider])

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
	} else if (address !== null && sessionSigner instanceof SIWESigner) {
		return (
			<button
				onClick={() => disconnect()}
				className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
			>
				Disconnect burner wallet
			</button>
		)
	} else {
		return (
			<button
				onClick={() => connect()}
				className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
			>
				Connect burner wallet
			</button>
		)
	}
}
