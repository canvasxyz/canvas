import { createContext } from "react"

import { PrivateUserRegistration, Room } from "../shared/index.js"

export interface AppContext {
	user: PrivateUserRegistration | null
	setUser: (user: PrivateUserRegistration | null) => void

	currentRoom: Room | null
	setCurrentRoom: (room: Room | null) => void
}

export const AppContext = createContext<AppContext>({
	user: null,
	setUser: () => {
		throw new Error("missing AppContext provider")
	},

	currentRoom: null,
	setCurrentRoom: (room) => {
		throw new Error("missing AppContext provider")
	},
})
