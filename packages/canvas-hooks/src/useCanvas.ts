import { useContext, useEffect } from "react"

import type { ActionArgument } from "@canvas-js/core"

import { CanvasContext } from "./CanvasContext.js"
import { useSigner } from "./useSigner.js"
import { useSession } from "./useSession.js"

/**
 * Here are the rules for the useCanvas hook:
 * - Initially, `loading` is true and `multihash` and `address` are null.
 * - Once the hook connects to both window.ethereum and the remote backend,
 *   `loading` will switch to false, with non-null `multihash`. However, `address`
 *   might still be null, in which case you MUST call `connect` to request accounts.
 * - Calling `connect` with `window.ethereum === undefined` will throw an error.
 * - Calling `connect` or `dispatch` while `loading` is true will throw an error.
 * - Once `loading` is true, you can call `dispatch` with a `call` string and `args` array.
 *   If no existing session is found in localStorage, or if the existing session has
 *   expired, then this will prompt the user to sign a new session key.
 */
export function useCanvas(): {
	loading: boolean
	error: Error | null
	multihash: string | null
	address: string | null
	dispatch: (call: string, args: ActionArgument[]) => Promise<void>
	connect: () => Promise<void>
} {
	const { error, host, multihash } = useContext(CanvasContext)

	useEffect(() => {
		if (host === undefined) {
			throw new Error("no host configured - you must set a host property in a parent Canvas element")
		}
	}, [])

	const { loading, address, signer, connect } = useSigner()
	const { dispatch } = useSession(address, signer)

	return { error, multihash, loading: multihash === null || loading, address, dispatch, connect }
}
