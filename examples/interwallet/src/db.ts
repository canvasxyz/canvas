import Dexie, { Table } from "dexie"

import { PublicUserRegistration } from "./interfaces"

export type Message = {
	room: string
	sender: string
	content: string
	timestamp: number
}

export type Room = {
	id: string
	creator: string
	members: PublicUserRegistration[]
}

export class InterwalletChatDB extends Dexie {
	users!: Table<PublicUserRegistration, string>
	rooms!: Table<Room, string>
	messages!: Table<Message, number>

	constructor() {
		super("InterwalletChatDB")
		this.version(1).stores({
			users: "address",
			rooms: "id, *members.address",
			messages: "++id, room, timestamp",
		})
	}
}

export const db = new InterwalletChatDB()
