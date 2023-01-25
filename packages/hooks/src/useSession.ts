import { useCallback, useContext, useEffect, useState } from "react"

import { Block, SessionPayload } from "@canvas-js/interfaces"
import type { SessionSigner } from "@canvas-js/signers/lib/interfaces"

import { CanvasContext } from "./CanvasContext.js"
import { getRecentBlock, urlJoin } from "./utils.js"
import { getSessionObject, setSessionObject, removeSessionObject, SessionObject } from "./sessionKeyStorage.js"

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

		const sessionObject = getSessionObject(data, signerAddress)
		if (sessionObject) {
			const { sessionPrivateKey, expiration } = sessionObject
			signer!.createActionSigner(sessionPrivateKey).then((actionSigner) => {
				setActionSigner(actionSigner)
			})
			setSessionExpiration(expiration)
		}
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
				from: signerAddress,
				app: data.uri,
				appName: data.appName,
				sessionAddress: actionSigner.address,
				sessionDuration,
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

			setSessionObject(signerAddress, sessionObject)

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
			removeSessionObject(signerAddress)
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
