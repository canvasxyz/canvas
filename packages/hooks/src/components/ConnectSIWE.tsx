import React, { useCallback, useContext, useEffect, useRef, useState } from "react"
import { Eip1193Provider, BrowserProvider, EventEmitterable } from "ethers"

import { SIWESigner, SIWFSigner } from "@canvas-js/signer-ethereum"
import { Canvas } from "@canvas-js/core"
import { DidIdentifier, SessionSigner } from "@canvas-js/interfaces"

// import { AppContext } from "../AppContext.js"

declare global {
	// eslint-disable-next-line no-var
	var ethereum: undefined | null | (Eip1193Provider & EventEmitterable<"accountsChanged" | "chainChanged">)
}

export interface ConnectSIWEProps {
	app: Canvas<any>
	sessionSigner: SessionSigner | null,
	setSessionSigner: (signer: SessionSigner | null) => void
	address: string | null
	setAddress: (address: string | null) => void
}

export const ConnectSIWE: React.FC<ConnectSIWEProps> = ({
	app,
	sessionSigner,
	setSessionSigner,
	address,
	setAddress,
}) => {
	// const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)

	const [provider, setProvider] = useState<BrowserProvider | null>(null)
	const [error, setError] = useState<Error | null>(null)

	const connect = useCallback(
		async (provider: BrowserProvider | null, isBrowserInit?: boolean) => {
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

			if (!(await signer.hasSession(app.topic))) {
				if (isBrowserInit) {
					return
				} else {
					const session = await signer.newSession(app.topic)
					await app.messageLog.append(session.payload, { signer: session.signer })
				}
			}

			const address = await signer.getDid()
			setAddress(address)

			const otherSigners = app.signers.getAll().filter((s) => !(s instanceof SIWESigner))
			otherSigners.forEach((s) => s.clearSession(app.topic))
			app.updateSigners([signer, ...otherSigners])
			setSessionSigner(signer)
		},
		[app, provider],
	)

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

		// automatically log back in
		connect(provider, true)
	}, [])

	const disconnect = useCallback(async () => {
		if (app?.topic) sessionSigner?.clearSession(app?.topic)
		setAddress(null)
		setSessionSigner(null)
		app?.updateSigners([new SIWESigner(), new SIWFSigner()])
	}, [app, sessionSigner])

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
				onClick={() => {
					connect(new BrowserProvider(window.ethereum!))
				}}
				className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
			>
				Connect ETH wallet
			</button>
		)
	}
}
