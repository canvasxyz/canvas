import { createContext } from "react"

import type { API } from "./API.js"

export type AppContext = {
	state: API["/api/state"] | null

	selected: null | { topic: string; contract: string }
	select: (topic: string) => void
}

export const AppContext = createContext<AppContext>({
	state: null,

	selected: null,
	select(topic) {
		throw new Error("missing AppContext provider")
	},
})
