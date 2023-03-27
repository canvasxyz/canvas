import { createContext } from "react"

import type { Core } from "@canvas-js/core"
import { Client } from "@canvas-js/hooks"

export type AppContextValue = {
	core: Core | null
	client: Client | null
	setClient: (client: Client | null) => void
}

export const AppContext = createContext<AppContextValue>({
	core: null,
	client: null,
	setClient(client) {
		throw new Error("Not parent <Canvas /> element provided")
	},
})
