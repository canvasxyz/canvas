import { createContext } from "react"

import type { Client } from "@canvas-js/hooks"

export const AppContext = createContext<{ client: Client | null; setClient: (client: Client | null) => void }>({
	client: null,
	setClient(client) {
		throw new Error("Missing <Canvas /> parent element")
	},
})
