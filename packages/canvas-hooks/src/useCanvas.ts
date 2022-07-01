import { useContext } from "react"

import { ActionArgument } from "@canvas-js/interfaces"

import { CanvasContext } from "./CanvasContext.js"
import { CanvasSession } from "./useSession.js"

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
	multihash: string | null
	error: Error | null
	loading: boolean
	address: string | null
	session: CanvasSession | null
	dispatch: (call: string, args: ActionArgument[]) => Promise<void>
	connect: () => Promise<void>
	disconnect: () => Promise<void>
} {
	const { multihash, error, loading, address, session, dispatch, connect, disconnect } = useContext(CanvasContext)
	return { multihash, error, loading, address, session, dispatch, connect, disconnect }
}
