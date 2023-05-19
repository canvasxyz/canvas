import { openDB } from "idb"

import { rooms } from "../fixtures"
import { ROOM_REGISTRY_TOPIC, USER_REGISTRY_TOPIC } from "../constants"

export const storeDB = await openDB("interwallet", 1, {
	upgrade(database, oldVersion, newVersion, transaction, event) {
		console.log(`upgrading IndexedDB database from ${oldVersion} to ${newVersion}`)

		for (const topic of [USER_REGISTRY_TOPIC, ROOM_REGISTRY_TOPIC, ...rooms.map(({ topic }) => topic)]) {
			if (database.objectStoreNames.contains(topic)) {
				continue
			} else {
				database.createObjectStore(topic)
				console.log(`created object store ${topic}`)
			}
		}
	},
})
