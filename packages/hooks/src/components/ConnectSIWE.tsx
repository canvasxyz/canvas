import React, { useCallback, useContext, useEffect, useRef, useState } from "react"
import { Eip1193Provider, BrowserProvider, EventEmitterable } from "ethers"

import { SIWESigner } from "@canvas-js/signer-ethereum"
import { Canvas } from "@canvas-js/core"
import { AuthContext } from "../AuthContext.js"
import { styles } from "./styles.js"

declare global {
	// eslint-disable-next-line no-var
	var ethereum: undefined | null | (Eip1193Provider & EventEmitterable<"accountsChanged" | "chainChanged">)
}

export interface ConnectSIWEProps {
	buttonStyles?: React.CSSProperties
	errorStyles?: React.CSSProperties
	errorTextStyes?: React.CSSProperties
	buttonClassName?: string
	errorClassName?: string
}

export const useSIWE = (app?: Canvas<any>) => {
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
			setSessionSigner(signer)
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
		app.updateSigners([...otherSigners, new SIWESigner({ readOnly: true })])
	}, [app, sessionSigner])

	const ConnectSIWE = ({ buttonStyles, errorStyles, errorClassName, buttonClassName }: ConnectSIWEProps = {}) => {
		if (!app) {
			return (
				<div
					className={errorClassName || ""}
					style={{
						...styles.errorContainer,
						...errorStyles,
					}}
				>
					<code>App not initialized</code>
				</div>
			)
		} else if (error !== null) {
			return (
				<div
					className={errorClassName || ""}
					style={{
						...styles.errorContainer,
						...errorStyles,
					}}
				>
					<code>{error.message}</code>
				</div>
			)
		} else if (provider === null) {
			return (
				<button
					disabled
					className={buttonClassName || ""}
					style={{
						...styles.loadingButton,
						...buttonStyles,
					}}
				>
					Loading...
				</button>
			)
		} else if (address !== null && sessionSigner instanceof SIWESigner) {
			return (
				<button
					onClick={() => disconnect()}
					className={buttonClassName || ""}
					style={{
						...styles.actionButton,
						...buttonStyles,
					}}
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
					className={buttonClassName || ""}
					style={{
						...styles.actionButton,
						...buttonStyles,
					}}
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
		isInitialized: !!app,
	}
}
