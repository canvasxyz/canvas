import type { SessionSigner, ActionSigner } from "@canvas-js/signers"
import React, { useState } from "react"

import { CanvasContext, ApplicationData } from "./CanvasContext.js"
import { useWebsocket } from "./useWebsocket.js"

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
	const ws = useWebsocket({ setIsLoading, setData, setError, host })

	return (
		<CanvasContext.Provider
			value={{
				isLoading,
				error,
				host,
				data,
				ws,
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
