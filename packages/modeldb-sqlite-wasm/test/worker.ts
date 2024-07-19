import * as Comlink from "comlink"
import sqlite3InitModule from "@sqlite.org/sqlite-wasm"
import { InnerModelDB } from "@canvas-js/modeldb-sqlite-wasm"
import { Config } from "@canvas-js/modeldb"

export async function initialize(origin: string, path: string, config: Config) {
	console.log("import.meta.url:")
	console.log(import.meta.url)

	console.log(origin)

	const sqlite3 = await sqlite3InitModule({
		print: console.log,
		printErr: console.error,
		locateFile: (file) => {
			console.log(`locating ${origin}/${file}`)
			return `${origin}/${file}`
		},
	})
	const db = new sqlite3.oo1.OpfsDb(path)
	return Comlink.proxy(new InnerModelDB(db, config))
}

Comlink.expose(initialize)
