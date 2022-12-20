import { Action, ActionPayload } from "@canvas-js/interfaces"
import { useCallback, useContext, useState } from "react"

import { CanvasContext, ApplicationData } from "./CanvasContext.js"
import { urlJoin, Dispatch, getCanvasSessionKey } from "./utils.js"

export function useCanvas(): {
	isLoading: boolean
	isPending: boolean
	isReady: boolean
	error: Error | null
	host: string | null
	data: ApplicationData | null
	dispatch: Dispatch
} {
	const {
		isLoading,
		error,
		host,
		data,
		signer,
		actionSigner,
		setActionSigner,
		sessionExpiration,
		setSessionExpiration,
	} = useContext(CanvasContext)

	const [isPending, setIsPending] = useState(false)

	const dispatch: Dispatch = useCallback(
		async (call, args) => {
			console.log("dispatch:", call, args)
			if (host === null) {
				throw new Error("no host configured")
			} else if (signer === null) {
				throw new Error("dispatch() called without a provider")
			} else if (actionSigner === null || sessionExpiration === null) {
				throw new Error("dispatch() called while logged out")
			} else if (data === null) {
				throw new Error("dispatch called before the application connection was established")
			}

			const timestamp = Date.now()
			if (sessionExpiration < timestamp) {
				setActionSigner(null)
				setSessionExpiration(null)
				throw new Error("Session expired. Please log in again.")
			}

			setIsPending(true)
			console.log("set pending to true")

			try {
				const block = await signer.getRecentBlock()
				console.log("got block", block)

				const address = await signer.getAddress()
				console.log("from address", address)

				const payload: ActionPayload = {
					from: address,
					spec: data.uri,
					call,
					args,
					timestamp,
					blocknum: block.blocknum,
					blockhash: block.blockhash,
					chain: block.chain,
					chainId: block.chainId,
				}

				const action: Action = await actionSigner.signActionPayload(payload)
				const res = await fetch(urlJoin(host, "actions"), {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(action),
				}).catch((err) => {
					console.log(err)
					if (err.message === "Failed to fetch") throw new Error("Could not reach server")
					throw err
				})

				if (!res.ok) {
					const message = await res.text()
					if (message === "session not found" || message === "session expired") {
						setActionSigner(null)
						setSessionExpiration(null)
						const address = await signer.getAddress()
						const sessionKey = getCanvasSessionKey(address)
						localStorage.removeItem(sessionKey)
					}

					throw new Error(message)
				}

				const { hash } = await res.json()
				return { hash }
			} finally {
				setIsPending(false)
			}
		},
		[host, data, signer, actionSigner, sessionExpiration]
	)

	const isReady = !isPending && actionSigner !== null
	return { isLoading, isPending, isReady, error, host, data, dispatch }
}
