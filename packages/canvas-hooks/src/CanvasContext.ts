import { createContext } from "react"

import { ActionArgument } from "@canvas-js/interfaces"

import { CanvasSession } from "./useSession.js"

export interface CanvasContextValue {
	host?: string
	cid: string | null
	uri: string | null
	error: Error | null
	loading: boolean
	address: string | null
	session: CanvasSession | null
	connect: () => Promise<void>
	connectNewSession: () => Promise<void>
	disconnect: () => Promise<void>
	dispatch: (call: string, ...args: ActionArgument[]) => Promise<void>
}

export const CanvasContext = createContext<CanvasContextValue>({
	cid: null,
	uri: null,
	error: null,
	loading: true,
	address: null,
	session: null,
	connect: () => Promise.reject(),
	connectNewSession: () => Promise.reject(),
	disconnect: () => Promise.reject(),
	dispatch: (call, ...args) => Promise.reject(),
})
