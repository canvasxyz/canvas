import type { IDBPDatabase } from "idb"

export const getIndexName = (index: string[]) => index.join("/")

// TODO: throw a custom error here, and catch it and rebuild modeldb from the log
export const checkForMissingObjectStores = (db: IDBPDatabase, names: string[]) => {
	for (const name of names) {
		if (!db.objectStoreNames.contains(name)) {
			throw new Error(`IndexedDB store '${db.name}->${name}' was expected, but not found.

If necessary, you can clear IndexedDB by running this in the console:

const dbs = await window.indexedDB.databases()
dbs.forEach(db => { window.indexedDB.deleteDatabase(db.name) })`)
		}
	}
}
