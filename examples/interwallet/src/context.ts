import { createContext } from "react"
import { PrivateUserRegistration } from "./interfaces"

export interface AppContext {
	user: PrivateUserRegistration | null
	setUser: (user: PrivateUserRegistration) => void

	pageTitle: string | null
	setPageTitle: (title: string) => void
}

export const AppContext = createContext<AppContext>({
	user: null,
	setUser() {
		throw new Error("Missing AppContext provider")
	},

	pageTitle: null,
	setPageTitle() {
		throw new Error("Missing AppContext provider")
	},
})
