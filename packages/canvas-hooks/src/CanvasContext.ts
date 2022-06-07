import { createContext } from "react"

import { ActionArgument } from "@canvas-js/interfaces"

export interface CanvasContextValue {
	host?: string
	multihash: string | null
	error: Error | null
	loading: boolean
	address: string | null
	connect: () => Promise<void>
	dispatch: (call: string, args: ActionArgument[]) => Promise<void>
}

export const CanvasContext = createContext<CanvasContextValue>({
	multihash: null,
	error: null,
	loading: true,
	address: null,
	connect: () => Promise.reject(),
	dispatch: (call, args) => Promise.reject(),
})
