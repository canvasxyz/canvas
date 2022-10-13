import { useCallback, useEffect, useState } from "react"

import { ethers } from "ethers"

import {
	Action,
	ActionArgument,
	Block,
	ActionPayload,
	SessionPayload,
	getSessionSignatureData,
	getActionSignatureData,
} from "@canvas-js/interfaces"

export const CANVAS_SESSION_KEY = "CANVAS_SESSION"

export type CanvasSession = {
	address: string
	expiration: number
}

type SessionObject = {
	spec: string
	forPublicKey: string
	sessionPrivateKey: string
	expiration: number
}

export function useSession(
	host: string,
	uri: string | null,
	address: string | null,
	signer: ethers.providers.JsonRpcSigner | null,
	provider: ethers.providers.Provider | null
): {
	dispatch: (call: string, ...args: ActionArgument[]) => Promise<void>
	session: CanvasSession | null
	connectNewSession: () => Promise<void>
	disconnect: () => Promise<void>
} {
	const [sessionSigner, setSessionSigner] = useState<ethers.Wallet | null>(null)
	const [sessionExpiration, setSessionExpiration] = useState<number>(0)

	const loadExistingSession = useCallback((uri: string, address: string, value: string | null) => {
		if (value !== null) {
			let sessionObject: SessionObject
			try {
				sessionObject = JSON.parse(value)
			} catch (e) {
				localStorage.removeItem(CANVAS_SESSION_KEY)
				setSessionSigner(null)
				setSessionExpiration(0)
				return
			}

			if (sessionObject.spec === uri && sessionObject.forPublicKey === address) {
				const sessionSigner = new ethers.Wallet(sessionObject.sessionPrivateKey)
				setSessionSigner(sessionSigner)
				setSessionExpiration(sessionObject.expiration)
			} else {
				localStorage.removeItem(CANVAS_SESSION_KEY)
				setSessionSigner(null)
				setSessionExpiration(0)
			}
		}
	}, [])

	// useEffect(() => {
	// 	window.addEventListener("storage", (event) => {
	// 		if (event.key === CANVAS_SESSION_KEY) {
	// 		}
	// 	})
	// }, [])

	useEffect(() => {
		if (uri !== null && address !== null) {
			const item = localStorage.getItem(CANVAS_SESSION_KEY)
			loadExistingSession(uri, address, item)
		}
	}, [uri, address])

	const dispatch = useCallback(
		async (call: string, ...args: ActionArgument[]) => {
			if (provider === null) {
				throw new Error("no web3 provider found")
			} else if (host === undefined) {
				throw new Error("no host configured")
			} else if (uri === null || address === null || signer === null) {
				throw new Error("dispatch called too early")
			}

			let contextSessionSigner = sessionSigner
			if (sessionSigner === null || sessionExpiration < +Date.now()) {
				const session = await newSession(signer, host, uri, provider)
				localStorage.setItem(CANVAS_SESSION_KEY, JSON.stringify(session[1]))
				setSessionSigner(session[0])
				setSessionExpiration(session[1].expiration)
				contextSessionSigner = session[0]
			}
			if (contextSessionSigner === null) throw new Error("session login failed")

			const timestamp = +Date.now() // get a new timestamp, from after we have secured a session
			let block: Block
			try {
				const [network, providerBlock] = await Promise.all([provider.getNetwork(), provider.getBlock("latest")])
				block = {
					chain: "eth",
					chainId: network.chainId,
					blocknum: providerBlock.number,
					blockhash: providerBlock.hash,
					timestamp: providerBlock.timestamp,
				}
			} catch (err) {
				console.error(err)
				throw err
			}
			const payload: ActionPayload = { from: address, spec: uri, call, args, timestamp, block }

			await send(host, contextSessionSigner, payload)
		},
		[host, uri, address, signer, sessionSigner, sessionExpiration]
	)

	const session = sessionSigner && {
		address: sessionSigner.address,
		expiration: sessionExpiration,
	}

	const connectNewSession = useCallback(async () => {
		if (provider === null) {
			throw new Error("no web3 provider found")
		}
		if (uri === null) {
			throw new Error("failed to connect to application backend")
		}
		if (signer === null) {
			throw new Error("must have connected web3 signer to log in")
		}
		const [sessionSigner, sessionObject] = await newSession(signer, host, uri, provider)
		localStorage.setItem(CANVAS_SESSION_KEY, JSON.stringify(sessionObject))
		setSessionSigner(sessionSigner)
		setSessionExpiration(sessionObject.expiration)
	}, [host, uri, signer, sessionSigner, sessionExpiration])

	const disconnect = useCallback(async () => {
		setSessionSigner(null)
		setSessionExpiration(0)
		localStorage.removeItem(CANVAS_SESSION_KEY)
	}, [])

	return { dispatch, session, connectNewSession, disconnect }
}

async function newSession(
	signer: ethers.providers.JsonRpcSigner,
	host: string,
	uri: string,
	provider: ethers.providers.Provider
): Promise<[ethers.Wallet, SessionObject]> {
	const timestamp = Date.now().valueOf()
	const sessionDuration = 86400 * 1000
	const sessionSigner = ethers.Wallet.createRandom()

	const address = await signer.getAddress()
	const from = address.toLowerCase()

	const sessionObject: SessionObject = {
		spec: uri,
		forPublicKey: from,
		sessionPrivateKey: sessionSigner.privateKey,
		expiration: timestamp + sessionDuration,
	}

	let block: Block
	try {
		const [network, providerBlock] = await Promise.all([provider.getNetwork(), provider.getBlock("latest")])
		block = {
			chain: "eth",
			chainId: network.chainId,
			blocknum: providerBlock.number,
			blockhash: providerBlock.hash,
			timestamp: providerBlock.timestamp,
		}
	} catch (err) {
		console.error(err)
		throw err
	}

	const payload: SessionPayload = {
		from: from,
		spec: uri,
		address: sessionSigner.address,
		duration: sessionDuration,
		timestamp,
		block,
	}

	const signatureData = getSessionSignatureData(payload)
	const signature = await signer._signTypedData(...signatureData)
	const session = { signature, payload }

	const res = await fetch(`${host}/sessions`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(session),
	})

	if (!res.ok) {
		localStorage.removeItem(CANVAS_SESSION_KEY)
		const err = await res.text()
		throw new Error(err)
	}

	return [sessionSigner, sessionObject]
}

async function send(host: string, sessionSigner: ethers.Wallet, payload: ActionPayload) {
	const signatureData = getActionSignatureData(payload)
	const signature = await sessionSigner._signTypedData(...signatureData)
	const action: Action = { session: sessionSigner.address, signature, payload }
	const res = await fetch(`${host}/actions`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(action),
	})

	if (!res.ok) {
		const message = await res.text()
		if (message === "session not found") {
			localStorage.removeItem(CANVAS_SESSION_KEY)
		}
		throw new Error(message)
	}
}
