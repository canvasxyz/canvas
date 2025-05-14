import { createContext } from "react"

import type { SessionSigner } from "@canvas-js/interfaces"
import { Canvas } from "@canvas-js/core"

export type AppContext = {
	app: Canvas | null
}

export const AppContext = createContext<AppContext>({
	app: null,
})
