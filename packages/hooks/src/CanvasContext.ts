import { createContext } from "react"
import { ApplicationData, CoreAPI } from "@canvas-js/interfaces"

export interface CanvasContextValue {
	isLoading: boolean
	error: Error | null
	api: CoreAPI | null
	data: ApplicationData | null
}

export const CanvasContext = createContext<CanvasContextValue>({
	isLoading: true,
	api: null,
	error: null,
	data: null,
})
