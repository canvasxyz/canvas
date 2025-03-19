import { createContext } from "react"

import type { SessionSigner } from "@canvas-js/interfaces"
import { Canvas } from "@canvas-js/core"

export type AppContext = {
	app: Canvas | null

	address: string | null
	setAddress: (address: string | null) => void

	sessionSigner: SessionSigner | null
	setSessionSigner: (signer: SessionSigner | null) => void
}

export const AppContext = createContext<AppContext>({
	app: null,

	address: null,
	setAddress: (address: string | null) => {
		throw new Error("AppContext.Provider not found")
	},

	sessionSigner: null,
	setSessionSigner: (signer) => {
		throw new Error("AppContext.Provider not found")
	},
})
