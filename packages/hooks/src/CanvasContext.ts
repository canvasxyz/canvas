import type { SessionSigner, ActionSigner } from "@canvas-js/signers"
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
	signer: SessionSigner | null
	setSigner: (signer: SessionSigner | null) => void
	actionSigner: ActionSigner | null
	setActionSigner: (actionSigner: ActionSigner | null) => void
	sessionExpiration: number | null
	setSessionExpiration: (sessionExpiration: number | null) => void
}

export const CanvasContext = createContext<CanvasContextValue>({
	isLoading: true,
	host: null,
	error: null,
	data: null,
	ws: null,

	signer: null,
	setSigner: (_) => {
		throw new Error("Missing <Canvas /> parent element")
	},

	actionSigner: null,
	setActionSigner: (_) => {
		throw new Error("Missing <Canvas /> parent element")
	},

	sessionExpiration: null,
	setSessionExpiration: (_) => {
		throw new Error("Missing <Canvas /> parent element")
	},
})
