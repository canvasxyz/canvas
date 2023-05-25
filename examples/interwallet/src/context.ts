import { Libp2p } from "@libp2p/interface-libp2p"

import { createContext } from "react"
import { PrivateUserRegistration } from "./interfaces"
import { RoomManager } from "./manager"
import { ServiceMap } from "./libp2p"

export interface AppContext {
	manager: RoomManager | null

	libp2p: Libp2p<ServiceMap> | null

	user: PrivateUserRegistration | null
	setUser: (user: PrivateUserRegistration) => void

	pageTitle: string | null
	setPageTitle: (title: string) => void

	roomId: string | null
	setRoomId: (roomId: string) => void
}

export const AppContext = createContext<AppContext>({
	manager: null,

	libp2p: null,

	user: null,
	setUser() {
		throw new Error("Missing AppContext provider")
	},

	roomId: null,
	setRoomId() {
		throw new Error("Missing AppContext provider")
	},

	pageTitle: null,
	setPageTitle() {
		throw new Error("Missing AppContext provider")
	},
})
