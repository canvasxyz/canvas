import { openDB } from "idb"

export const userRegistryStoreName = "store:users"
export const roomRegistryStoreName = "store:rooms"

export const db = await openDB("interwallet", 1, {
	upgrade(database, oldVersion, newVersion, transaction, event) {
		console.log(`upgrading IndexedDB database from ${oldVersion} to ${newVersion}`)

		for (const storeName of [userRegistryStoreName, roomRegistryStoreName]) {
			if (database.objectStoreNames.contains(storeName)) {
				continue
			} else {
				database.createObjectStore(storeName)
				console.log(`created object store ${storeName}`)
			}
		}
	},
})
