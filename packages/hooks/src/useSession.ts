import { useCallback, useContext, useEffect, useState } from "react"

import { SessionPayload, Session } from "@canvas-js/interfaces"
import type { SessionSigner } from "@canvas-js/signers/lib/interfaces"

import { CanvasContext } from "./CanvasContext.js"
import { getCanvasSessionKey, urlJoin } from "./utils.js"

export function useSession(signer: SessionSigner | null): {
	error: Error | null
	isLoading: boolean
	isPending: boolean
	sessionAddress: string | null
	sessionExpiration: number | null
	login: () => void
	logout: () => void
} {
	const { host, data, setSigner, actionSigner, setActionSigner, sessionExpiration, setSessionExpiration } =
		useContext(CanvasContext)

	const [error, setError] = useState<null | Error>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isPending, setIsPending] = useState(false)

	const [signerAddress, setSignerAddress] = useState<string | null>(null)
	useEffect(() => {
		if (signer === null) {
			setSignerAddress(null)
			setSigner(null)
		} else {
			signer.getAddress().then((address) => {
				setSignerAddress(address)
				setSigner(signer)
			})
		}

		setActionSigner(null)
		setSessionExpiration(null)
	}, [signer])

	useEffect(() => {
		if (host === null || data === null || signerAddress === null) {
			return
		}

		setIsLoading(false)

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

		const { spec, sessionPrivateKey, expiration } = sessionObject
		if (data.uri !== spec || expiration < Date.now()) {
			localStorage.removeItem(sessionKey)
			return
		}

		signer!.createActionSigner(sessionPrivateKey).then((actionSigner) => {
			setActionSigner(actionSigner)
		})
		setSessionExpiration(expiration)
	}, [host, data, signerAddress])

	const login = useCallback(async () => {
		if (host === null) {
			return setError(new Error("no host configured"))
		} else if (signer === null) {
			return setError(new Error("login() called without a signer"))
		} else if (signerAddress === null) {
			return setError(new Error("login() called before the signer was ready"))
		} else if (data === null) {
			return setError(new Error("login() called before the application connection was established"))
		}

		setIsPending(true)

		try {
			const timestamp = Date.now()
			const sessionDuration = 86400 * 1000
			const actionSigner = await signer.createActionSigner()

			const sessionObject: SessionObject = {
				spec: data.uri,
				sessionPrivateKey: actionSigner.privateKey,
				expiration: timestamp + sessionDuration,
			}

			const block = await signer.getRecentBlock()

			const chain = await signer.getChain()
			const chainId = await signer.getChainId()

			const payload: SessionPayload = {
				from: signerAddress,
				spec: data.uri,
				address: actionSigner.address,
				duration: sessionDuration,
				timestamp,
				blockhash: block.blockhash,
				chain: block.chain,
				chainId: block.chainId,
			}

			const session: Session = await signer.signSessionPayload(payload)

			const res = await fetch(urlJoin(host, "sessions"), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(session),
			})

			if (!res.ok) {
				const message = await res.text()
				throw new Error(message)
			}

			const sessionKey = getCanvasSessionKey(signerAddress)
			localStorage.setItem(sessionKey, JSON.stringify(sessionObject))
			setActionSigner(actionSigner)
			setSessionExpiration(sessionObject.expiration)
			setError(null)
		} catch (err) {
			console.error(err)
			if (err instanceof Error) {
				setError(err)
			} else {
				throw err
			}
		} finally {
			setIsPending(false)
		}
	}, [host, data, signer, signerAddress])

	const logout = useCallback(() => {
		setActionSigner(null)
		setSessionExpiration(null)
		if (signerAddress !== null) {
			const sessionKey = getCanvasSessionKey(signerAddress)
			localStorage.removeItem(sessionKey)
		}
	}, [signerAddress])

	const sessionAddress = actionSigner && actionSigner.address
	return {
		error,
		isLoading,
		isPending,
		sessionAddress,
		sessionExpiration,
		login,
		logout,
	}
}

type SessionObject = { spec: string; sessionPrivateKey: string; expiration: number }

function isSessionObject(obj: any): obj is SessionObject {
	return (
		typeof obj === "object" &&
		typeof obj.spec === "string" &&
		typeof obj.sessionPrivateKey === "string" &&
		typeof obj.expiration === "number"
	)
}
