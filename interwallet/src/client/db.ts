import Dexie, { Table } from "dexie"

import type { Room, PublicUserRegistration } from "../shared/index.js"

export type Message = {
	room: string
	sender: string
	content: string
	timestamp: number
}

class InterwalletChatDB extends Dexie {
	users!: Table<PublicUserRegistration, string>
	rooms!: Table<Room, string>
	messages!: Table<Message, number>

	constructor() {
		super("interwallet:ui-db")
		this.version(1).stores({
			users: "address",
			rooms: "id, *members.address",
			messages: "++id, room, timestamp",
		})
	}
}

export const db = new InterwalletChatDB()
