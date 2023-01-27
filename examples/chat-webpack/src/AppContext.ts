import { Client } from "@canvas-js/hooks"
import { createContext } from "react"

export const AppContext = createContext<{
	client: Client | null
	setClient: (client: Client | null) => void
}>({
	client: null,
	setClient(client) {
		throw new Error("Missing <Canvas /> parent element")
	},
})
