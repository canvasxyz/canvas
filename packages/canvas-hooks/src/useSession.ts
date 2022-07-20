import { useCallback, useEffect, useState } from "react"

import { ethers } from "ethers"

import {
	Action,
	ActionArgument,
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
	multihash: string | null,
	address: string | null,
	signer: ethers.providers.JsonRpcSigner | null
): {
	dispatch: (call: string, args: ActionArgument[]) => Promise<void>
	session: CanvasSession | null
	connectNewSession: () => Promise<void>
	disconnect: () => Promise<void>
} {
	const [sessionSigner, setSessionSigner] = useState<ethers.Wallet | null>(null)
	const [sessionExpiration, setSessionExpiration] = useState<number>(0)

	const loadExistingSession = useCallback((multihash: string, address: string, value: string | null) => {
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

			if (sessionObject.spec === multihash && sessionObject.forPublicKey === address) {
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
		if (multihash !== null && address !== null) {
			const item = localStorage.getItem(CANVAS_SESSION_KEY)
			loadExistingSession(multihash, address, item)
		}
	}, [multihash, address])

	const dispatch = useCallback(
		async (call: string, args: ActionArgument[]) => {
			if (host === undefined) {
				throw new Error("no host configured")
			} else if (multihash === null || address === null || signer === null) {
				throw new Error("dispatch called too early")
			}

			const timestamp = +Date.now()
			const payload: ActionPayload = { from: address, spec: multihash, call, args, timestamp }

			if (sessionSigner === null || sessionExpiration < timestamp) {
				const [sessionSigner, sessionObject] = await newSession(signer, host, multihash)
				localStorage.setItem(CANVAS_SESSION_KEY, JSON.stringify(sessionObject))
				setSessionSigner(sessionSigner)
				setSessionExpiration(sessionObject.expiration)
				await send(host, sessionSigner, payload)
			} else {
				await send(host, sessionSigner, payload)
			}
		},
		[host, multihash, address, signer, sessionSigner, sessionExpiration]
	)

	const session = sessionSigner && {
		address: sessionSigner.address,
		expiration: sessionExpiration,
	}

	const connectNewSession = useCallback(async () => {
		if (multihash === null) {
			throw new Error("failed to connect to application backend")
		}
		if (signer === null) {
			throw new Error("must have connected web3 signer to log in")
		}
		const [sessionSigner, sessionObject] = await newSession(signer, host, multihash)
		localStorage.setItem(CANVAS_SESSION_KEY, JSON.stringify(sessionObject))
		setSessionSigner(sessionSigner)
		setSessionExpiration(sessionObject.expiration)
	}, [host, multihash, signer, sessionSigner, sessionExpiration])

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
	multihash: string
): Promise<[ethers.Wallet, SessionObject]> {
	const timestamp = Date.now().valueOf()
	const sessionDuration = 86400 * 1000
	const sessionSigner = ethers.Wallet.createRandom()

	const address = await signer.getAddress()
	const from = address.toLowerCase()

	const sessionObject: SessionObject = {
		spec: multihash,
		forPublicKey: from,
		sessionPrivateKey: sessionSigner.privateKey,
		expiration: timestamp + sessionDuration,
	}

	const payload: SessionPayload = {
		from: from,
		spec: multihash,
		session_public_key: sessionSigner.address,
		session_duration: sessionDuration,
		timestamp,
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
		throw new Error(message)
	}
}
