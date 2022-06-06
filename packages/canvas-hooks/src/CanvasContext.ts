import { createContext } from "react"

export interface CanvasContextValue {
	host?: string
	multihash: string | null
	error: Error | null
}

export const CanvasContext = createContext<CanvasContextValue>({ multihash: null, error: null })
