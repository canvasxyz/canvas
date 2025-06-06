import React, { useCallback, useContext, useState } from "react"
import { Eip1193Provider, EventEmitterable } from "ethers"

import { Eip712Signer } from "@canvas-js/signer-ethereum"

import { AppContext } from "../AppContext.js"

declare global {
	// eslint-disable-next-line no-var
	var ethereum: undefined | null | (Eip1193Provider & EventEmitterable<"accountsChanged" | "chainChanged">)
}

export interface ConnectEIP712BurnerProps {}

export const ConnectEIP712Burner: React.FC<ConnectEIP712BurnerProps> = ({}) => {
	const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)

	const [error, setError] = useState<Error | null>(null)

	const connect = useCallback(async () => {
		if (app === null) {
			setError(new Error("app not initialized"))
			return
		}

		const signer = new Eip712Signer({ burner: true })
		const address = await signer.getDid()
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
	} else if (address !== null && sessionSigner instanceof Eip712Signer) {
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
