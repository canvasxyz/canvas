import { Logger } from "@libp2p/logger"
import * as Comlink from "comlink"
import sqlite3InitModule from "@sqlite.org/sqlite-wasm"
import { Config } from "@canvas-js/modeldb"
import { InnerModelDB } from "./InnerModelDB.js"

export async function initialize(path: string, config: Config, log: Logger) {
	const sqlite3 = await sqlite3InitModule({
		print: console.log,
		printErr: console.error,
	})
	const db = new sqlite3.oo1.OpfsDb(path)
	return Comlink.proxy(new InnerModelDB(db, config, log))
}

Comlink.expose(initialize)
