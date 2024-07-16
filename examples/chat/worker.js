import * as Comlink from "comlink"
import sqlite3InitModule from "@sqlite.org/sqlite-wasm"
import { InnerModelDB } from "@canvas-js/modeldb-sqlite-wasm"

export async function initialize(path, config) {
	const sqlite3 = await sqlite3InitModule({ print: console.log, printErr: console.error })
	return Comlink.proxy(new InnerModelDB(sqlite3, path, config))
}

Comlink.expose(initialize)
