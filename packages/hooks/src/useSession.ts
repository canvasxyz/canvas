import { useCallback, useContext, useEffect, useMemo, useState } from "react"

import {
	ActionArgument,
	ChainImplementation,
	InvalidChainError,
	InvalidChainIdError,
	ApplicationData,
} from "@canvas-js/interfaces"

import { CanvasContext } from "./CanvasContext.js"
import { getSessionObject, setSessionObject, removeSessionObject, SessionObject } from "./sessionKeyStorage.js"

const second = 1000
const minute = 60 * second
const hour = 60 * minute

export type CallOptions = {
	timestamp?: number
}

export type Client = Record<
	string,
	(callArgs: Record<string, ActionArgument>, callOptions?: CallOptions) => Promise<{ hash: string }>
>

const BLOCK_CACHE_TIME = 1.5 * second

let cachedBlock: [string, number] | null = null

const getLatestBlockWithCache = async (chainImplementation: ChainImplementation): Promise<string> => {
	if (cachedBlock !== null && cachedBlock[1] > +new Date() - BLOCK_CACHE_TIME) {
		return cachedBlock[0]
	} else {
		const block: string = await chainImplementation.getLatestBlock()
		cachedBlock = [block, +new Date()]
		return block
	}
}

/**
 * isLoading === true: waiting for application data from host, & checking localStorage for sessionObject
 * isLoading === false && sessionAddress === null: logged out, need to call login()
 * isLoading === false && sessionAddress !== null: we have a session and `client` will be non-null
 *
 * `client`, `sessionAddress`, and `sessionExpiration` are either all null or all non-null.
 */

export function useSession<Signer, DelegatedSigner>(
	chainImplementation: ChainImplementation<Signer, DelegatedSigner>,
	signer: Signer | null | undefined,
	options: { sessionDuration?: number; unchecked?: boolean } = {}
): {
	isLoading: boolean
	isPending: boolean
	sessionAddress: string | null
	sessionExpiration: number | null
	login: () => Promise<void>
	logout: () => Promise<void>
	client: Client | null
} {
	const { chain, chainId } = chainImplementation

	const { api, data } = useContext(CanvasContext)

	const [isLoading, setIsLoading] = useState(true)
	const [isPending, setIsPending] = useState(false)

	const [sessionSigner, setSessionSigner] = useState<DelegatedSigner | null>(null)
	const [sessionAddress, setSessionAddress] = useState<string | null>(null)
	const [sessionExpiration, setSessionExpiration] = useState<number | null>(null)

	const loadSavedSession = useCallback(async (data: ApplicationData, signer: Signer) => {
		const signerAddress = await chainImplementation.getSignerAddress(signer)
		const sessionObject = getSessionObject(chain, chainId, signerAddress)

		if (sessionObject !== null) {
			if (sessionObject.app !== data.uri || sessionObject.expiration < Date.now()) {
				removeSessionObject(chain, chainId, signerAddress)
			} else {
				const delegatedSigner = chainImplementation.importDelegatedSigner(sessionObject.sessionPrivateKey)
				const sessionAddress = await chainImplementation.getDelegatedSignerAddress(delegatedSigner)

				// const res = await fetch(`${host}/sessions`, {
				// 	method: "POST",
				// 	headers: { "Content-Type": "application/json" },
				// 	body: JSON.stringify({
				// 		hasSession: sessionAddress,
				// 		chain: chain,
				// 		chainId: chainId,
				// 	}),
				// })
				// const { hasSession } = await res.json()

				// if (hasSession) {
				setSessionAddress(sessionAddress)
				setSessionSigner(delegatedSigner)
				setSessionExpiration(sessionObject.expiration)
				setIsLoading(false)
				return
				// }
			}
		}

		setSessionAddress(null)
		setSessionSigner(null)
		setSessionExpiration(null)
		setIsLoading(false)
	}, [])

	useEffect(() => {
		if (api === null || data === null || signer === null || signer === undefined) {
			return
		}

		loadSavedSession(data, signer)
	}, [api, data, signer])

	const login = useCallback(async () => {
		if (api === null) {
			throw new Error("no Core API provider configured")
		} else if (data === null) {
			throw new Error("login() called before a connection to the Canvas node was established")
		} else if (signer === null || signer === undefined) {
			throw new Error("login() called without a signer")
		} else if (isPending) {
			throw new Error("another login() call is already pending")
		}

		try {
			setIsPending(true)

			const signerAddress = await chainImplementation.getSignerAddress(signer)
			const sessionIssued = Date.now()
			const sessionDuration = options.sessionDuration ?? 24 * hour

			const delegatedSigner = await chainImplementation.generateDelegatedSigner()
			const sessionAddress = await chainImplementation.getDelegatedSignerAddress(delegatedSigner)

			const sessionObject: SessionObject = {
				app: data.uri,
				sessionPrivateKey: chainImplementation.exportDelegatedSigner(delegatedSigner),
				expiration: sessionIssued + sessionDuration,
			}

			const block = options.unchecked ? null : await chainImplementation.getLatestBlock()

			const supportedChainIds = data.chainImplementations[chain]
			if (supportedChainIds === undefined) {
				throw new InvalidChainError(`Invalid chain: ${chain}:${chainId}`)
			}

			if (!supportedChainIds.includes(chainId)) {
				throw new InvalidChainIdError(`Invalid chain ID: ${chain}:${chainId}`)
			}

			const session = await chainImplementation.signSession(signer, {
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

			await api.apply(session)

			setSessionObject(chain, chainId, signerAddress, sessionObject)
			setSessionSigner(delegatedSigner)
			setSessionAddress(sessionAddress)
			setSessionExpiration(sessionObject.expiration)
		} finally {
			setIsPending(false)
		}
	}, [signer, api, data, isPending])

	const logout = useCallback(async () => {
		if (signer) {
			const signerAddress = await chainImplementation.getSignerAddress(signer)
			removeSessionObject(chain, chainId, signerAddress)
		}

		setSessionSigner(null)
		setSessionAddress(null)
		setSessionExpiration(null)
	}, [signer])

	const dispatch = useCallback(
		async (
			call: string,
			callArgs: Record<string, ActionArgument>,
			callOptions?: CallOptions
		): Promise<{ hash: string }> => {
			if (api === null) {
				throw new Error("no Core API connection configured")
			} else if (data === null) {
				throw new Error("dispatch() called before the application connection was established")
			} else if (signer === null || signer === undefined) {
				throw new Error("dispatch() called without a signer")
			} else if (sessionSigner === null || sessionExpiration === null) {
				throw new Error("dispatch() called before login")
			} else if (sessionExpiration < Date.now()) {
				throw new Error("session expired, please log in again")
			}

			const block = options.unchecked ? null : await getLatestBlockWithCache(chainImplementation)

			const action = await chainImplementation.signDelegatedAction(sessionSigner, {
				app: data.uri,
				appName: data.appName,
				from: await chainImplementation.getSignerAddress(signer),
				call,
				callArgs,
				chain,
				chainId,
				timestamp: callOptions?.timestamp ?? Date.now(),
				block: options.unchecked ? null : block,
			})

			try {
				return api.apply(action)
			} catch (err) {
				if (err instanceof Error) {
					if (err.message === "session not found" || err.message === "session expired") {
						const signerAddress = await chainImplementation.getSignerAddress(signer)
						removeSessionObject(chain, chainId, signerAddress)
						setSessionSigner(null)
						setSessionAddress(null)
						setSessionExpiration(null)
					}
				}

				throw err
			}
		},

		[api, data, signer, sessionSigner, sessionExpiration]
	)

	const client = useMemo<Client | null>(
		() =>
			data &&
			Object.fromEntries(
				data.actions.map((action) => [action, (args, callOptions?: CallOptions) => dispatch(action, args, callOptions)])
			),
		[data, dispatch]
	)

	return {
		isLoading,
		isPending,
		sessionAddress,
		sessionExpiration,
		login,
		logout,
		client: signer && sessionSigner && Date.now() < (sessionExpiration ?? 0) ? client : null,
	}
}
