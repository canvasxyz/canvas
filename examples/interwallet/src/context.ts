import { createContext } from "react"

export interface AppContext {
	pageTitle: string | null
	setPageTitle: (title: string) => void
}

export const AppContext = createContext<AppContext>({
	pageTitle: null,
	setPageTitle() {
		throw new Error("Missing AppContext provider")
	},
})
