import { createContext } from "react"

import { Canvas } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"

export type AppContext = {
	signer: SIWESigner | null
	setSigner: (signer: SIWESigner | null) => void

	app: Canvas | null
	setApp: (app: Canvas | null) => void
}

export const AppContext = createContext<AppContext>({
	signer: null,
	setSigner: (signer) => {
		throw new Error("AppContext.Provider not found")
	},

	app: null,
	setApp: (app) => {
		throw new Error("AppContext.Provider not found")
	},
})
