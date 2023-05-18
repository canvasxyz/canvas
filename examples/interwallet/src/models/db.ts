import Dexie, { Table } from "dexie"
import { MessageEvent } from "./MessageEvent"
import { Room } from "./Room"

export class InterwalletChatDB extends Dexie {
	rooms!: Table<Room, number>
	messageEvents!: Table<MessageEvent, number>

	constructor() {
		super("InterwalletChatDB")
		this.version(1).stores({
			rooms: "++id",
			messageEvents: "++id,room_id,timestamp",
		})
	}
}

export const db = new InterwalletChatDB()

export function resetDatabase() {
	return db.transaction("rw", db.rooms, db.messageEvents, async () => {
		await Promise.all(db.tables.map((table) => table.clear()))
	})
}
