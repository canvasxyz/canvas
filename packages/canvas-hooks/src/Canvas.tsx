import React, { useState, useEffect } from "react"

import { CanvasContext } from "./CanvasContext.js"
import { useSession } from "./useSession.js"
import { useSigner } from "./useSigner.js"

export const CANVAS_SESSION_LOCALSTORAGE_KEY = "CANVAS_SESSION"

export interface CanvasProps {
	host: string
	children: JSX.Element
}

const etagPattern = /^"(.+)"$/
const linkPattern = /^<(.+)>; rel="self"$/

export const Canvas: React.FC<CanvasProps> = (props) => {
	const [cid, setCID] = useState<string | null>(null)
	const [uri, setURI] = useState<string | null>(null)
	const [error, setError] = useState<Error | null>(null)

	useEffect(() => {
		fetch(props.host, { method: "HEAD" })
			.then((res) => {
				const etag = res.headers.get("ETag")
				const link = res.headers.get("Link")
				if (res.ok && etag !== null && link !== null) {
					const cid = etagPattern.exec(etag)?.at(1)
					const uri = linkPattern.exec(link)?.at(1)
					if (cid === undefined || uri === undefined) {
						setError(new Error("Invalid response from remote API"))
					} else {
						setCID(cid)
						setURI(uri)
					}
				} else {
					setError(new Error("Invalid response from remote API"))
				}
			})
			.catch((err) => setError(err))
	}, [])

	const { loading, address, connect, provider, signer } = useSigner()
	const { dispatch, session, connectNewSession, disconnect } = useSession(props.host, uri, address, signer, provider)

	return (
		<CanvasContext.Provider
			value={{
				host: props.host,
				cid,
				uri,
				error,
				loading: cid === null || uri === null || loading,
				address,
				session,
				connect,
				connectNewSession,
				disconnect,
				dispatch,
			}}
		>
			{props.children}
		</CanvasContext.Provider>
	)
}
