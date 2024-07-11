import sqlite3InitModule from "@sqlite.org/sqlite-wasm"

import { MessageData } from "./types.js"
import { InnerModelDB } from "./InnerModelDB.js"

let innerModelDb: InnerModelDB

onmessage = (event: MessageEvent<MessageData>) => {
	handle(event.data).then((result) => postMessage(result))
}

async function handle(data: MessageData) {
	const messageType = data.type
	if (messageType == "initialize") {
		const sqlite3 = await sqlite3InitModule({ print: console.log, printErr: console.error })
		const db = new sqlite3.oo1.OpfsDb("/mydb.sqlite3")
		innerModelDb = new InnerModelDB(db, data.config)
	} else if (messageType == "get") {
		// something
	} else {
		throw new Error(`unknown message type: ${messageType}`)
	}
}
