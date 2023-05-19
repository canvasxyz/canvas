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

export const modelDB = new InterwalletChatDB()

export function resetDatabase() {
	return modelDB.transaction("rw", modelDB.rooms, modelDB.messageEvents, async () => {
		await Promise.all(modelDB.tables.map((table) => table.clear()))
	})
}
