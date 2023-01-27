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

	const host = props.host
	const ws = useWebsocket({ host, setIsLoading, setData, setError })

	return <CanvasContext.Provider value={{ isLoading, error, host, data, ws }}>{props.children}</CanvasContext.Provider>
}
