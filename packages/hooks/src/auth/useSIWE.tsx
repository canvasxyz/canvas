import React, { useCallback, useContext, useEffect, useRef, useState } from "react"
import { Wallet, Eip1193Provider, BrowserProvider, EventEmitterable } from "ethers"

import { SIWESigner } from "@canvas-js/signer-ethereum"
import { Canvas } from "@canvas-js/core"
import { AuthContext } from "./AuthContext.js"
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
	label?: string
	loadingText?: string
	logoutText?: string
}

const BURNER_WALLET_KEY = "canvas-connectsiwe-burner-wallet-key"

const getBurnerWallet = () => {
	let wallet
	try {
		const privateKey = localStorage.getItem(BURNER_WALLET_KEY)
		if (privateKey) {
			wallet = new Wallet(privateKey)
		} else {
			wallet = Wallet.createRandom()
			localStorage.setItem(BURNER_WALLET_KEY, wallet.privateKey)
		}
	} catch (error) {
		wallet = Wallet.createRandom()
		localStorage.setItem(BURNER_WALLET_KEY, wallet.privateKey)
	}
	return wallet
}

export const useSIWE = (app: Canvas | null | undefined) => {
	const { sessionSigner, setSessionSigner, address, setAddress } = useContext(AuthContext)
	const [provider, setProvider] = useState<BrowserProvider | null>(null)
	const [error, setError] = useState<Error | null>(null)
	const [browserWalletLoggedIn, setBrowserWalletLoggedIn] = useState(false)
	const [burnerWalletLoggedIn, setBurnerWalletLoggedIn] = useState(false)

	const connect = useCallback(
		async (
			config:
				| {
						provider: BrowserProvider | null
						isReturningSession?: boolean
				  }
				| {
						burner: boolean
						isReturningSession?: boolean
				  },
		) => {
			const provider = "provider" in config ? config.provider : null
			const burner = "burner" in config ? config.burner : false
			const isReturningSession = config.isReturningSession

			if (!app) {
				setError(new Error("app not initialized"))
				return null
			}

			let signer
			if (burner) {
				const wallet = getBurnerWallet()
				signer = new SIWESigner({ signer: wallet })
			} else {
				if (provider === null) {
					setError(new Error("window.ethereum not found"))
					return null
				}

				setProvider(provider)

				const network = await provider.getNetwork()
				signer = await provider
					.getSigner()
					.then((signer) => new SIWESigner({ signer, chainId: Number(network.chainId) }))
			}

			if (!(await signer.hasSession(app.topic))) {
				if (isReturningSession) {
					return null
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

			setBrowserWalletLoggedIn(false)
			setBurnerWalletLoggedIn(false)

			return signer
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
			connect({ burner: true, isReturningSession: true }).then((result) => {
				if (result !== null) {
					setBurnerWalletLoggedIn(true)
				}
			})
			return
		}

		// TODO: handle these more gracefully
		window.ethereum.on("chainChanged", (chainId) => window.location.reload())
		window.ethereum.on("accountsChanged", (accounts) => window.location.reload())

		const provider = new BrowserProvider(window.ethereum)
		setProvider(provider)

		// automatically log back in, trying the browser wallet first
		connect({ provider, isReturningSession: true }).then((result) => {
			if (result === null) {
				connect({ burner: true, isReturningSession: true }).then((result2) => {
					if (result2 !== null) {
						setBurnerWalletLoggedIn(true)
					}
				})
			} else {
				setBrowserWalletLoggedIn(true)
			}
		})
	}, [app])

	const disconnect = useCallback(async () => {
		if (!app?.topic) return
		sessionSigner?.clearSession(app.topic)
		setAddress(null)
		setSessionSigner(null)
		setBrowserWalletLoggedIn(false)
		setBurnerWalletLoggedIn(false)
		const otherSigners = app.signers.getAll().filter((s) => !(s instanceof SIWESigner))
		app.updateSigners([...otherSigners, new SIWESigner({ readOnly: true })])
	}, [app, sessionSigner])

	const ConnectSIWE = ({
		buttonStyles,
		errorStyles,
		errorClassName,
		buttonClassName,
		label,
		loadingText,
		logoutText,
	}: ConnectSIWEProps = {}) => {
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
					{loadingText ?? "Loading..."}
				</button>
			)
		} else if (address !== null && browserWalletLoggedIn && sessionSigner instanceof SIWESigner) {
			return (
				<button
					onClick={() => disconnect()}
					className={buttonClassName || ""}
					style={{
						...styles.actionButton,
						...buttonStyles,
					}}
				>
					{logoutText ?? "Disconnect"}
				</button>
			)
		} else {
			return (
				<button
					onClick={() => {
						connect({ provider: new BrowserProvider(window.ethereum!), isReturningSession: false }).then((result) => {
							if (result !== null) setBrowserWalletLoggedIn(true)
						})
					}}
					className={buttonClassName || ""}
					style={{
						...styles.actionButton,
						...buttonStyles,
					}}
				>
					{label ?? "Connect browser wallet"}
				</button>
			)
		}
	}

	const ConnectSIWEBurner = ({
		buttonStyles,
		errorStyles,
		errorClassName,
		buttonClassName,
		label,
		loadingText,
		logoutText,
	}: ConnectSIWEProps = {}) => {
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
					{loadingText ?? "Loading..."}
				</button>
			)
		} else if (address !== null && burnerWalletLoggedIn && sessionSigner instanceof SIWESigner) {
			return (
				<button
					onClick={() => disconnect()}
					className={buttonClassName || ""}
					style={{
						...styles.actionButton,
						...buttonStyles,
					}}
				>
					{logoutText ?? "Disconnect"}
				</button>
			)
		} else {
			return (
				<button
					onClick={() => {
						connect({ burner: true, isReturningSession: false }).then((result) => {
							if (result !== null) setBurnerWalletLoggedIn(true)
						})
					}}
					className={buttonClassName || ""}
					style={{
						...styles.actionButton,
						...buttonStyles,
					}}
				>
					{label ?? "Connect burner wallet"}
				</button>
			)
		}
	}

	return {
		ConnectSIWE,
		ConnectSIWEBurner,
		connectSIWE: () => {
			connect({ provider: new BrowserProvider(window.ethereum!), isReturningSession: false }).then((result) => {
				if (result !== null) setBrowserWalletLoggedIn(true)
			})
		},
		connectSIWEBurner: () => {
			connect({ burner: true, isReturningSession: false }).then((result) => {
				if (result !== null) setBurnerWalletLoggedIn(true)
			})
		},
		address,
		error,
		provider,
		connect,
		disconnect,
		sessionSigner,
		isInitialized: !!app,
	}
}
