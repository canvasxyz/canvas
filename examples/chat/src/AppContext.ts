import { createContext } from "react"

import { Canvas } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"

export type AppContext = {
	address: string | null
	setAddress: (address: string | null) => void

	sessionSigner: SIWESigner | null
	setSessionSigner: (signer: SIWESigner | null) => void

	app: Canvas | null
	setApp: (app: Canvas | null) => void
}

export const AppContext = createContext<AppContext>({
	address: null,
	setAddress: (address: string | null) => {
		throw new Error("AppContext.Provider not found")
	},

	sessionSigner: null,
	setSessionSigner: (signer) => {
		throw new Error("AppContext.Provider not found")
	},

	app: null,
	setApp: (app) => {
		throw new Error("AppContext.Provider not found")
	},
})
