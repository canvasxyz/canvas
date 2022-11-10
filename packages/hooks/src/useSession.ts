import { useCallback, useContext, useEffect, useState } from "react"
import { ethers } from "ethers"

import { SessionPayload, getSessionSignatureData, Session } from "@canvas-js/interfaces"

import { CanvasContext } from "./CanvasContext.js"
import urlJoin, { CANVAS_SESSION_KEY, getLatestBlock } from "./utils.js"

export function useSession(signer: ethers.providers.JsonRpcSigner | null): {
	error: Error | null
	isLoading: boolean
	isPending: boolean
	sessionAddress: string | null
	sessionExpiration: number | null
	login: () => void
	logout: () => void
} {
	const { host, data, setSigner, sessionWallet, setSessionWallet, sessionExpiration, setSessionExpiration } =
		useContext(CanvasContext)

	const [error, setError] = useState<null | Error>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isPending, setIsPending] = useState(false)

	const [signerAddress, setSignerAddress] = useState<string | null>(null)
	useEffect(() => {
		if (signer === null) {
			setSignerAddress(null)
			setSigner(null)
			setSessionWallet(null)
			setSessionExpiration(null)
		} else {
			signer.getAddress().then((address) => {
				setSigner(signer)
				setSignerAddress(address)
			})
		}
	}, [signer])

	useEffect(() => {
		if (host === null || data === null || signerAddress === null) {
			return
		}

		setIsLoading(false)

		const item = localStorage.getItem(CANVAS_SESSION_KEY)
		if (item === null) {
			return
		}

		const sessionObject = JSON.parse(item)
		if (!isSessionObject(sessionObject)) {
			localStorage.removeItem(CANVAS_SESSION_KEY)
			return
		}

		const { spec, forPublicKey, sessionPrivateKey, expiration } = sessionObject
		if (data.uri !== spec || signerAddress !== forPublicKey || expiration < Date.now()) {
			localStorage.removeItem(CANVAS_SESSION_KEY)
			return
		}

		const wallet = new ethers.Wallet(sessionPrivateKey)
		setSessionWallet(wallet)
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
			const wallet = ethers.Wallet.createRandom()

			const sessionObject: SessionObject = {
				spec: data.uri,
				forPublicKey: signerAddress,
				sessionPrivateKey: wallet.privateKey,
				expiration: timestamp + sessionDuration,
			}

			const block = await getLatestBlock(signer.provider)

			const payload: SessionPayload = {
				from: signerAddress,
				spec: data.uri,
				address: wallet.address,
				duration: sessionDuration,
				timestamp,
				block,
			}

			const sessionSignatureData = getSessionSignatureData(payload)
			const signature = await signer._signTypedData(...sessionSignatureData)
			const session: Session = { signature, payload }

			const res = await fetch(urlJoin(host, "sessions"), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(session),
			})

			if (!res.ok) {
				const message = await res.text()
				throw new Error(message)
			}

			localStorage.setItem(CANVAS_SESSION_KEY, JSON.stringify(sessionObject))
			setSessionWallet(wallet)
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
		setSessionWallet(null)
		setSessionExpiration(null)
		localStorage.removeItem(CANVAS_SESSION_KEY)
	}, [])

	const sessionAddress = sessionWallet && sessionWallet.address
	return {
		error,
		isLoading,
		isPending,
		// isSuccess,
		sessionAddress,
		sessionExpiration,
		login,
		logout,
	}
}

type SessionObject = { spec: string; forPublicKey: string; sessionPrivateKey: string; expiration: number }

function isSessionObject(obj: any): obj is SessionObject {
	return (
		typeof obj === "object" &&
		typeof obj.spec === "string" &&
		typeof obj.forPublicKey === "string" &&
		typeof obj.sessionPrivateKey === "string" &&
		typeof obj.expiration === "number"
	)
}
