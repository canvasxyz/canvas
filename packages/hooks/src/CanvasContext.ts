import { createContext } from "react"

export interface ApplicationData {
	cid: string
	uri: string
	appName: string
	peerId: string | null
	component: string | null
	actions: string[]
	routes: string[]
	peers: {
		gossip: Record<string, { lastSeen: number }>
		sync: Record<string, { lastSeen: number }>
	} | null
}

export interface CanvasContextValue {
	// public (returned from useCanvas hook)
	isLoading: boolean
	error: Error | null
	host: string | null
	data: ApplicationData | null

	// private (not returned from useCanvas hook)
	ws: WebSocket | null
}

export const CanvasContext = createContext<CanvasContextValue>({
	isLoading: true,
	host: null,
	error: null,
	data: null,
	ws: null,
})
