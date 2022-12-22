import type { SessionWallet, ActionWallet } from "@canvas-js/signers"
import { createContext } from "react"

export interface ApplicationData {
	cid: string
	uri: string
	peerId: string | null
	component: string | null
	actions: string[]
	routes: string[]
	peers: {
		gossip: Record<string, { lastSeen: number }>
		backlog: Record<string, { lastSeen: number }>
	}
}

export interface CanvasContextValue {
	// public (returned from useCanvas hook)
	isLoading: boolean
	error: Error | null
	host: string | null
	data: ApplicationData | null

	// private (not returned from useCanvas hook)
	ws: WebSocket | null
	sessionWallet: SessionWallet | null
	setSessionWallet: (sessionWallet: SessionWallet | null) => void
	actionWallet: ActionWallet | null
	setActionWallet: (actionWallet: ActionWallet | null) => void
	sessionExpiration: number | null
	setSessionExpiration: (sessionExpiration: number | null) => void
}

export const CanvasContext = createContext<CanvasContextValue>({
	isLoading: true,
	host: null,
	error: null,
	data: null,
	ws: null,

	sessionWallet: null,
	setSessionWallet: (_) => {
		throw new Error("Missing <Canvas /> parent element")
	},

	actionWallet: null,
	setActionWallet: (_) => {
		throw new Error("Missing <Canvas /> parent element")
	},

	sessionExpiration: null,
	setSessionExpiration: (_) => {
		throw new Error("Missing <Canvas /> parent element")
	},
})
