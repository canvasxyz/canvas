import { useCallback, useContext, useEffect, useState } from "react"

import { Block, SessionPayload } from "@canvas-js/interfaces"
import type { SessionSigner } from "@canvas-js/signers/lib/interfaces"

import { CanvasContext } from "./CanvasContext.js"
import { getCanvasSessionKey, getRecentBlock, urlJoin } from "./utils.js"

type UseSessionState = "logged_out" | "pending" | "logged_in"

function getSessionPrivateKeyFromLocalStorage(host: string, data: { uri: string }, signerAddress: string) {
	const sessionKey = getCanvasSessionKey(signerAddress)
	const item = localStorage.getItem(sessionKey)
	if (item === null) {
		return
	}

	let sessionObject: any
	try {
		sessionObject = JSON.parse(item)
	} catch (err) {
		localStorage.removeItem(sessionKey)
		return
	}

	if (!isSessionObject(sessionObject)) {
		localStorage.removeItem(sessionKey)
		return
	}

	const { app, sessionPrivateKey, expiration } = sessionObject
	if (data.uri !== app || expiration < Date.now()) {
		localStorage.removeItem(sessionKey)
		return
	}

	return { sessionPrivateKey, expiration }
}

async function getSessionObject(signer: SessionSigner, signerAddress: string, data: { uri: string }, host: string) {
	const timestamp = Date.now()
	const sessionDuration = 86400 * 1000
	const actionSigner = await signer.createActionSigner()

	const sessionObject: SessionObject = {
		app: data.uri,
		sessionPrivateKey: actionSigner.privateKey,
		expiration: timestamp + sessionDuration,
	}

	const chain = await signer.getChain()
	const chainId = await signer.getChainId()

	let block: Block
	try {
		block = await getRecentBlock(host, chain, chainId)
	} catch (err) {
		block = await signer.getRecentBlock()
	}

	const payload: SessionPayload = {
		app: data.uri,
		from: signerAddress,
		sessionAddress: actionSigner.address,
		sessionDuration: sessionDuration,
		sessionIssued: timestamp,
		block: block.blockhash,
		chain: block.chain,
		chainId: block.chainId,
	}

	const session = await signer.signSessionPayload(payload)

	const res = await fetch(urlJoin(host, "sessions"), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(session),
	})

	if (!res.ok) {
		const message = await res.text()
		throw new Error(message)
	}

	return sessionObject
}

export function useSession(signer: SessionSigner | null): {
	error: Error | null
	state: UseSessionState
	sessionAddress: string | null
	sessionExpiration: number | null
	login: () => void
	logout: () => void
} {
	const { host, data, setSigner, actionSigner, setActionSigner, sessionExpiration, setSessionExpiration } =
		useContext(CanvasContext)

	const [state, setState] = useState<UseSessionState>("logged_out")
	const [error, setError] = useState<null | Error>(null)

	useEffect(() => {
		setSigner(signer)
		setActionSigner(null)
		setSessionExpiration(null)
	}, [signer])

	// Try to log in by loading data from localStorage
	useEffect(() => {
		if (state !== "logged_out") {
			return
		}

		if (host === null || data === null || signer === null) {
			return
		}

		signer.getAddress().then((signerAddress) => {
			const res = getSessionPrivateKeyFromLocalStorage(host, data, signerAddress)
			if (res) {
				const { sessionPrivateKey, expiration } = res
				signer!.createActionSigner(sessionPrivateKey).then((actionSigner) => {
					setActionSigner(actionSigner)
					setSessionExpiration(expiration)
					setState("logged_in")
				})
			}
		})
	}, [host, data, signer])

	// Log in by clicking the log in button
	const login = useCallback(async () => {
		console.log("login function called...")
		if (host === null) {
			return setError(new Error("no host configured"))
		} else if (signer === null) {
			return setError(new Error("login() called without a signer"))
		} else if (data === null) {
			return setError(new Error("login() called before the application connection was established"))
		}

		setState("pending")

		try {
			const signerAddress = await signer.getAddress()
			const sessionObject = await getSessionObject(signer, signerAddress, data, host)
			const sessionKey = getCanvasSessionKey(signerAddress)
			localStorage.setItem(sessionKey, JSON.stringify(sessionObject))
			setActionSigner(actionSigner)
			setSessionExpiration(sessionObject.expiration)
			setError(null)
			setState("logged_in")
		} catch (err) {
			console.error(err)
			setState("logged_out")
			if (err instanceof Error) {
				setError(err)
			} else {
				throw err
			}
		}
	}, [host, data, signer])

	const logout = async () => {
		setActionSigner(null)
		setSessionExpiration(null)
		setState("logged_out")

		if (signer !== null) {
			const signerAddress = await signer?.getAddress()
			const sessionKey = getCanvasSessionKey(signerAddress)
			localStorage.removeItem(sessionKey)
		}
	}

	const sessionAddress = actionSigner && actionSigner.address
	return {
		error,
		state,
		sessionAddress,
		sessionExpiration,
		login,
		logout,
	}
}

type SessionObject = { app: string; sessionPrivateKey: string; expiration: number }

function isSessionObject(obj: any): obj is SessionObject {
	return (
		typeof obj === "object" &&
		typeof obj.app === "string" &&
		typeof obj.sessionPrivateKey === "string" &&
		typeof obj.expiration === "number"
	)
}
