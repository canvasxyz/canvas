import fs from "node:fs"
import path from "node:path"
import assert from "node:assert"

import hypercore from "hypercore"
import HyperBee from "hyperbee"

import { createPrefixStream } from "../../utils/prefixStream.js"

export const command = "ls <path>"
export const desc = "Print app action log"
export const builder = (yargs) => {
	yargs.positional("path", {
		describe: "Path of the app data directory",
		type: "string",
	})
}

export async function handler(args) {
	const appPath = path.resolve()
	assert(fs.existsSync(appPath), "path not found")

	const hypercorePath = path.resolve(args.path, "hypercore")
	assert(fs.existsSync(hypercorePath), "path not found")

	const feed = hypercore(hypercorePath, { createIfMissing: false })
	const db = new HyperBee(feed, { keyEncoding: "utf-8", valueEncoding: "utf-8" })
	await db.ready()

	for await (const [_, value] of createPrefixStream(db, "a:")) {
		console.log(value)
	}

	// Close the feed
	await new Promise((resolve, reject) => {
		feed.close((err) => {
			if (err === null) {
				resolve()
			} else {
				reject(err)
			}
		})
	})
}
