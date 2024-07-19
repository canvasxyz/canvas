import * as Comlink from "comlink"
import sqlite3InitModule from "@sqlite.org/sqlite-wasm"
import { InnerModelDB } from "@canvas-js/modeldb-sqlite-wasm"
import { Config } from "@canvas-js/modeldb"

export async function initialize(path: string, config: Config) {
	// const sqlite3 = await sqlite3InitModule({ print: console.log, printErr: console.error })
	// const db = new sqlite3.oo1.OpfsDb(path)
	// return Comlink.proxy(new InnerModelDB(db, config))
	return Comlink.proxy({})
}

Comlink.expose(initialize)
