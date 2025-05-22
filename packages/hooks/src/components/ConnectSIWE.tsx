import React, { useCallback, useContext, useEffect, useRef, useState } from "react"
import { Eip1193Provider, BrowserProvider, EventEmitterable } from "ethers"

import { SIWESigner } from "@canvas-js/signer-ethereum"
import { Canvas } from "@canvas-js/core"
import { AuthContext } from "../AuthContext.js"

declare global {
	// eslint-disable-next-line no-var
	var ethereum: undefined | null | (Eip1193Provider & EventEmitterable<"accountsChanged" | "chainChanged">)
}

export interface ConnectSIWEConfig {
	buttonStyles?: React.CSSProperties
	buttonTextStyles?: React.CSSProperties
	errorStyles?: React.CSSProperties
	errorTextStyes?: React.CSSProperties
	buttonClassName?: string
	errorClassName?: string
	containerClassName?: string
}

export const useSIWE = (app?: Canvas<any>, config?: ConnectSIWEConfig) => {
	const { sessionSigner, setSessionSigner, address, setAddress } = useContext(AuthContext)
	const [provider, setProvider] = useState<BrowserProvider | null>(null)
	const [error, setError] = useState<Error | null>(null)

	const connect = useCallback(
		async (provider: BrowserProvider | null, isBrowserInit?: boolean) => {
			if (!app) {
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
			console.log('s', signer)
			setSessionSigner(signer)
			console.log('ss1', sessionSigner)
			setTimeout(() => {
				console.log(sessionSigner)
			}, 100)
		},
		[app, provider],
	)

	const initialRef = useRef(false)
	useEffect(() => {
		if (initialRef.current || !app) {
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
	}, [app])

	const disconnect = useCallback(async () => {
		if (!app?.topic) return
		sessionSigner?.clearSession(app.topic)
		setAddress(null)
		setSessionSigner(null)
		const otherSigners = app.signers.getAll().filter((s) => !(s instanceof SIWESigner))
		app.updateSigners([...otherSigners, new SIWESigner()])
	}, [app, sessionSigner])

	const ConnectSIWE = () => {
		console.log('ss2', sessionSigner)
		if (!app) {
			return (
				<div className={`p-2 border rounded bg-red-100 text-sm ${config?.errorClassName || ''}`} style={config?.errorStyles ?? {}}>
					<code>App not initialized</code>
				</div>
			)
		} else if (error !== null) {
			return (
				<div className={`p-2 border rounded bg-red-100 text-sm ${config?.errorClassName || ''}`} style={config?.errorStyles ?? {}}>
					<code>{error.message}</code>
				</div>
			)
		} else if (provider === null) {
			return (
				<div className={`p-2 border rounded bg-gray-200 ${config?.containerClassName || ''}`} style={config?.buttonStyles ?? {}}>
					<button disabled className={config?.buttonClassName || ''}>Loading...</button>
				</div>
			)
		} else if (address !== null && sessionSigner instanceof SIWESigner) {
			return (
				<button
					onClick={() => disconnect()}
					className={`p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200 ${config?.buttonClassName || ''}`}
					style={config?.buttonTextStyles}
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
					className={`p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200 ${config?.buttonClassName || ''}`}
					style={config?.buttonTextStyles}
				>
					Connect ETH wallet
				</button>
			)
		}
	}

	return {
		ConnectSIWE,
		address,
		error,
		provider,
		connect,
		disconnect,
		sessionSigner,
		isInitialized: !!app
	}
}
