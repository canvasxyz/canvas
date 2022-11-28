import { ethers } from "ethers"
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
	signer: ethers.providers.JsonRpcSigner | null
	setSigner: (signer: ethers.providers.JsonRpcSigner | null) => void
	sessionWallet: ethers.Wallet | null
	setSessionWallet: (sessionWallet: ethers.Wallet | null) => void
	sessionExpiration: number | null
	setSessionExpiration: (sessionExpiration: number | null) => void
}

export const CanvasContext = createContext<CanvasContextValue>({
	isLoading: true,
	host: null,
	error: null,
	data: null,

	signer: null,
	setSigner: (_) => {
		throw new Error("Missing <Canvas /> parent element")
	},

	sessionWallet: null,
	setSessionWallet: (_) => {
		throw new Error("Missing <Canvas /> parent element")
	},

	sessionExpiration: null,
	setSessionExpiration: (_) => {
		throw new Error("Missing <Canvas /> parent element")
	},
})
