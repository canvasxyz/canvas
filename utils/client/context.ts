import { createContext } from "react"

interface AppContext {
	appBody: HTMLDivElement | null
}

export const AppContext = createContext<AppContext>({ appBody: null })
