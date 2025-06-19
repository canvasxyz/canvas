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

export enum SIWEStatus {
	NotInitialized = "NotInitialized",
	Loading = "Loading",
	Disconnected = "Disconnected",
	Connected = "Connected",
	Error = "Error",
	WaitingForSignature = "WaitingForSignature",
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
	const [isWaitingForSignature, setIsWaitingForSignature] = useState(false)

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
					setIsWaitingForSignature(true)
					try {
						const session = await signer.newSession(app.topic)
						await app.messageLog.append(session.payload, { signer: session.signer })
					} finally {
						setIsWaitingForSignature(false)
					}
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

	const getStatus = (
		app: Canvas | null | undefined,
		error: Error | null,
		provider: BrowserProvider | null,
		address: string | null,
		loggedIn: boolean,
		sessionSigner: any,
		isWaitingForSignature: boolean,
	) => {
		if (!app) return SIWEStatus.NotInitialized
		if (error !== null) return SIWEStatus.Error
		if (isWaitingForSignature) return SIWEStatus.WaitingForSignature
		if (provider === null) return SIWEStatus.Loading
		if (address !== null && loggedIn && sessionSigner instanceof SIWESigner) return SIWEStatus.Connected
		return SIWEStatus.Disconnected
	}

	const ConnectButton = ({
		type,
		buttonStyles,
		errorStyles,
		errorClassName,
		buttonClassName,
		label,
		loadingText,
		logoutText,
	}: ConnectSIWEProps & { type: "browser" | "burner" }) => {
		const isBurner = type === "burner"
		const loggedIn = isBurner ? burnerWalletLoggedIn : browserWalletLoggedIn
		const status = getStatus(app, error, provider, address, loggedIn, sessionSigner, isWaitingForSignature)
		const connectHandler = () => {
			if (isBurner) {
				connect({ burner: true, isReturningSession: false }).then((result) => {
					if (result !== null) setBurnerWalletLoggedIn(true)
				})
			} else {
				connect({ provider: new BrowserProvider(window.ethereum!), isReturningSession: false }).then((result) => {
					if (result !== null) setBrowserWalletLoggedIn(true)
				})
			}
		}

		if (status === SIWEStatus.NotInitialized) {
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
		} else if (status === SIWEStatus.Error) {
			return (
				<div
					className={errorClassName || ""}
					style={{
						...styles.errorContainer,
						...errorStyles,
					}}
				>
					<code>{error?.message}</code>
				</div>
			)
		} else if (status === SIWEStatus.Loading) {
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
		} else if (status === SIWEStatus.Connected) {
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
		} else if (!isBurner && status === SIWEStatus.WaitingForSignature) {
			return (
				<button
					onClick={connectHandler}
					className={buttonClassName || ""}
					style={{
						...styles.loadingButton,
						...buttonStyles,
					}}
				>
					Waiting for signature...
				</button>
			)
		} else {
			return (
				<button
					onClick={connectHandler}
					className={buttonClassName || ""}
					style={{
						...styles.actionButton,
						...buttonStyles,
					}}
				>
					{label ?? (isBurner ? "Connect burner wallet" : "Connect browser wallet")}
				</button>
			)
		}
	}

	return {
		ConnectSIWE: (props: ConnectSIWEProps) => <ConnectButton {...props} type="browser" />,
		ConnectSIWEBurner: (props: ConnectSIWEProps) => <ConnectButton {...props} type="burner" />,
		connectSIWE: () => {
			connect({ provider: new BrowserProvider(window.ethereum!), isReturningSession: false }).then((result) => {
				if (result !== null) setBrowserWalletLoggedIn(true)
			})
		},
		connectSIWEStatus: getStatus(
			app,
			error,
			provider,
			address,
			browserWalletLoggedIn,
			sessionSigner,
			isWaitingForSignature,
		),
		connectSIWEBurner: () => {
			connect({ burner: true, isReturningSession: false }).then((result) => {
				if (result !== null) setBurnerWalletLoggedIn(true)
			})
		},
		connectSIWEBurnerStatus: getStatus(
			app,
			error,
			provider,
			address,
			burnerWalletLoggedIn,
			sessionSigner,
			isWaitingForSignature,
		),
		address,
		error,
		provider,
		connect,
		disconnect,
		sessionSigner,
		isInitialized: !!app,
	}
}
