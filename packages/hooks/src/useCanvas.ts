import { useContext } from "react"

import { CanvasContext, ApplicationData } from "./CanvasContext.js"

export function useCanvas(): {
	isLoading: boolean
	error: Error | null
	host: string | null
	data: ApplicationData | null
} {
	const { error, isLoading, host, data } = useContext(CanvasContext)
	return { error, isLoading, host, data }
}
