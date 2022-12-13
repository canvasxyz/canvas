import type { SessionSigner, ActionSigner } from "@canvas-js/signers"
import React, { useState, useEffect } from "react"

import { CanvasContext, ApplicationData } from "./CanvasContext.js"

export interface CanvasProps {
	host: string
	children: React.ReactNode
}

export const Canvas: React.FC<CanvasProps> = (props) => {
	const [isLoading, setIsLoading] = useState(true)
	const [data, setData] = useState<ApplicationData | null>(null)
	const [error, setError] = useState<Error | null>(null)

	const [signer, setSigner] = useState<SessionSigner | null>(null)
	const [actionSigner, setActionSigner] = useState<ActionSigner | null>(null)
	const [sessionExpiration, setSessionExpiration] = useState<number | null>(null)

	const host = props.host

	useEffect(() => {
		const id = setInterval(() => {
			fetch(host)
				.then((res) => res.json())
				.then((data: ApplicationData) => setData(data))
				.catch((err) => setError(err))
				.finally(() => setIsLoading(false))
		}, 2500)
		return () => clearInterval(id)
	}, [host])

	return (
		<CanvasContext.Provider
			value={{
				isLoading,
				error,
				host,
				data,
				signer,
				setSigner,
				actionSigner,
				setActionSigner,
				sessionExpiration,
				setSessionExpiration,
			}}
		>
			{props.children}
		</CanvasContext.Provider>
	)
}
