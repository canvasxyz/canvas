import Dexie, { Table } from "dexie"

import { Message, Room, PublicUserRegistration } from "../interfaces"

export class InterwalletChatDB extends Dexie {
	users!: Table<PublicUserRegistration, string>
	rooms!: Table<Room, string>
	messages!: Table<Message, number>

	constructor() {
		super("InterwalletChatDB")
		this.version(1).stores({
			users: "address",
			rooms: "topic, *members",
			messages: "++id, room, timestamp",
		})
	}
}

export const modelDB = new InterwalletChatDB()
