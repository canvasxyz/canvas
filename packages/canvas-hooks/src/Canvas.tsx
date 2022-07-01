import React, { useState, useEffect } from "react"

import { CanvasContext } from "./CanvasContext.js"
import { useSession } from "./useSession.js"
import { useSigner } from "./useSigner.js"

export const CANVAS_SESSION_LOCALSTORAGE_KEY = "CANVAS_SESSION"

export interface CanvasProps {
	host: string
	children: JSX.Element
}

export const Canvas: React.FC<CanvasProps> = (props) => {
	const [multihash, setMultihash] = useState<string | null>(null)
	const [error, setError] = useState<Error | null>(null)

	useEffect(() => {
		const eTagPattern = /^"(.+)"$/
		fetch(props.host, { method: "HEAD" })
			.then((res) => {
				const etag = res.headers.get("ETag")
				if (res.ok && etag !== null && eTagPattern.test(etag)) {
					const [_, multihash] = eTagPattern.exec(etag)!
					setMultihash(multihash)
				} else {
					setError(new Error("Invalid response from remote API"))
				}
			})
			.catch((err) => {
				setError(err)
			})
	}, [])

	const { loading, address, signer, connect, disconnect } = useSigner()
	const { dispatch, session } = useSession(props.host, multihash, address, signer)

	return (
		<CanvasContext.Provider
			value={{
				host: props.host,
				multihash,
				error,
				loading: multihash === null || loading,
				address,
				session,
				connect,
				disconnect,
				dispatch,
			}}
		>
			{props.children}
		</CanvasContext.Provider>
	)
}
