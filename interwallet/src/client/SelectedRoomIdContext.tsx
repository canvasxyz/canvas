import { createContext } from "react"

export interface SelectedRoomIdContext {
	selectedRoomId: string | null
	setSelectedRoomId: (roomId: string | null) => void
}

export const SelectedRoomIdContext = createContext<SelectedRoomIdContext>({
	selectedRoomId: null,
	setSelectedRoomId: () => {
		throw new Error("Missing SelectedRoomIdContext provider")
	},
})
