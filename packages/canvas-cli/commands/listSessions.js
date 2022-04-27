import fs from "node:fs"
import path from "node:path"
import assert from "node:assert"

import hypercore from "hypercore"
import HyperBee from "hyperbee"

import { createPrefixStream } from "../utils/prefixStream.js"

export const command = "sessions <multihash> [--datadir=apps]"
export const desc = "Print app session log"
export const builder = (yargs) => {
	yargs
		.positional("multihash", {
			describe: "Hash of the spec from IPFS",
			type: "string",
			demandOption: true,
		})
		.option("datadir", {
			describe: "Path of the app data directory",
			type: "string",
			default: "./apps",
		})
}

export async function handler(args) {
	const appPath = path.resolve(args.datadir, args.multihash)
	if (!fs.existsSync(appPath)) {
		console.log("App not found. Have you tried running the app yet?")
		process.exit(1)
	}

	const hypercorePath = path.resolve(appPath, "hypercore")
	if (!fs.existsSync(hypercorePath)) {
		console.log("App initialized, but no action log found. Have you tried running the app yet?")
		process.exit(1)
	}

	const feed = hypercore(hypercorePath, { createIfMissing: false })
	const db = new HyperBee(feed, { keyEncoding: "utf-8", valueEncoding: "utf-8" })
	await db.ready()

	console.log("Listing sessions...")
	for await (const [_, value] of createPrefixStream(db, "s:")) {
		console.log(value)
	}

	// Close the feed
	await new Promise((resolve, reject) => {
		feed.close((err) => {
			if (err === null) {
				console.log("Done")
				resolve()
			} else {
				reject(err)
			}
		})
	})
}
