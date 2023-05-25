import { Libp2p } from "@libp2p/interface-libp2p"

import { createContext } from "react"
import { PrivateUserRegistration } from "./interfaces"
import { RoomManager } from "./manager"
import { PeerId } from "@libp2p/interface-peer-id"

export interface AppContext {
	peerId: PeerId | null
	manager: RoomManager | null

	user: PrivateUserRegistration | null
	setUser: (user: PrivateUserRegistration) => void

	pageTitle: string | null
	setPageTitle: (title: string) => void

	roomId: string | null
	setRoomId: (roomId: string) => void
}

export const AppContext = createContext<AppContext>({
	peerId: null,
	manager: null,

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
