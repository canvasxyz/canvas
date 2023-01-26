import { useCallback, useContext, useEffect, useState } from "react"

import { ActionArgument, ChainImplementation } from "@canvas-js/interfaces"

import { ApplicationData, CanvasContext } from "./CanvasContext.js"
import { getSessionObject, setSessionObject, removeSessionObject, SessionObject } from "./sessionKeyStorage.js"

const second = 1000
const minute = 60 * second
const hour = 60 * minute

export function useSession<Signer, DelegatedSigner>(
	chainImplementation: ChainImplementation<Signer, DelegatedSigner>,
	signer: Signer | null,
	options: { sessionDuration?: number; unchecked?: boolean } = {}
): {
	isLoading: boolean
	isPending: boolean
	sessionAddress: string | null
	sessionExpiration: number | null
	login: () => void
	logout: () => void
	dispatch: (call: string, callArgs: Record<string, ActionArgument>) => Promise<{ hash: string }>
} {
	const {
		chain,
		chainId,
		generateDelegatedSigner,
		exportDelegatedSigner,
		importDelegatedSigner,
		getSignerAddress,
		getDelegatedSignerAddress,
		getLatestBlock,
		signSession,
		signDelegatedAction,
	} = chainImplementation

	const { host, data } = useContext(CanvasContext)

	const [isLoading, setIsLoading] = useState(true)
	const [isPending, setIsPending] = useState(false)

	const [sessionSigner, setSessionSigner] = useState<DelegatedSigner | null>(null)
	const [sessionAddress, setSessionAddress] = useState<string | null>(null)
	const [sessionExpiration, setSessionExpiration] = useState<number | null>(null)

	const loadSavedSession = useCallback(async (data: ApplicationData, signer: Signer) => {
		const signerAddress = await getSignerAddress(signer)
		const sessionObject = getSessionObject(chain, chainId, signerAddress)

		if (sessionObject !== null) {
			if (sessionObject.app !== data.uri || sessionObject.expiration < Date.now()) {
				removeSessionObject(chain, chainId, signerAddress)
			} else {
				const delegatedSigner = importDelegatedSigner(sessionObject.sessionPrivateKey)
				const sessionAddress = await getDelegatedSignerAddress(delegatedSigner)
				setSessionAddress(sessionAddress)
				setSessionSigner(delegatedSigner)
				setSessionExpiration(sessionObject.expiration)
				setIsLoading(false)
				return
			}
		}

		setSessionAddress(null)
		setSessionSigner(null)
		setSessionExpiration(null)
		setIsLoading(false)
	}, [])

	useEffect(() => {
		if (host === null || data === null || signer === null) {
			return
		}

		loadSavedSession(data, signer)
	}, [host, data, signer])

	const login = useCallback(async () => {
		if (host === null) {
			throw new Error("no host configured")
		} else if (data === null) {
			throw new Error("login() called before the application connection was established")
		} else if (signer === null) {
			throw new Error("login() called without a signer")
		} else if (isPending) {
			throw new Error("another login() call is already pending")
		}

		try {
			setIsPending(true)

			const signerAddress = await getSignerAddress(signer)
			const sessionIssued = Date.now()
			const sessionDuration = options.sessionDuration ?? 24 * hour

			const delegatedSigner = await generateDelegatedSigner()
			const sessionAddress = await getDelegatedSignerAddress(delegatedSigner)

			const sessionObject: SessionObject = {
				app: data.uri,
				sessionPrivateKey: exportDelegatedSigner(delegatedSigner),
				expiration: sessionIssued + sessionDuration,
			}

			const block = options.unchecked ? null : await getLatestBlock()

			const session = await signSession(signer, {
				from: signerAddress,
				app: data.uri,
				appName: data.appName,
				sessionAddress,
				sessionDuration,
				sessionIssued,
				block,
				chain,
				chainId,
			})

			const res = await fetch(`${host}/sessions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(session),
			})

			if (!res.ok) {
				const message = await res.text()
				throw new Error(message)
			}

			setSessionObject(chain, chainId, signerAddress, sessionObject)

			setSessionSigner(delegatedSigner)
			setSessionAddress(sessionAddress)
			setSessionExpiration(sessionObject.expiration)
		} finally {
			setIsPending(false)
		}
	}, [signer, host, data, isPending])

	const logout = useCallback(async () => {
		if (signer !== null) {
			const signerAddress = await getSignerAddress(signer)
			removeSessionObject(chain, chainId, signerAddress)
		}

		setSessionSigner(null)
		setSessionAddress(null)
		setSessionExpiration(null)
	}, [signer])

	const dispatch = useCallback(
		async (call: string, callArgs: Record<string, ActionArgument>) => {
			if (host === null) {
				throw new Error("no host configured")
			} else if (data === null) {
				throw new Error("dispatch() called before the application connection was established")
			} else if (signer === null) {
				throw new Error("dispatch() called without a signer")
			} else if (sessionSigner === null || sessionExpiration === null) {
				throw new Error("dispatch() called before login")
			} else if (sessionExpiration < Date.now()) {
				throw new Error("session expired, please log in again")
			}

			const action = await signDelegatedAction(sessionSigner, {
				app: data.uri,
				appName: data.appName,
				from: await getSignerAddress(signer),
				call,
				callArgs,
				chain,
				chainId,
				timestamp: Date.now(),
				block: options.unchecked ? null : await getLatestBlock(),
			})

			const res = await fetch(`${host}/actions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(action),
			})

			if (res.ok) {
				return await res.json()
			} else {
				const message = await res.text()

				if (message === "session not found" || message === "session expired") {
					const signerAddress = await getSignerAddress(signer)
					removeSessionObject(chain, chainId, signerAddress)
					setSessionSigner(null)
					setSessionAddress(null)
					setSessionExpiration(null)
				}

				throw new Error(message)
			}
		},

		[host, data, signer, sessionSigner, sessionExpiration]
	)

	return {
		isLoading,
		isPending,
		sessionAddress,
		sessionExpiration,
		login,
		logout,
		dispatch,
	}
}
