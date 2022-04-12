import fs from "node:fs"
import path from "node:path"
import assert from "node:assert"

import hypercore from "hypercore"
import HyperBee from "hyperbee"

import { createPrefixStream } from "../../utils/prefixStream.js"

export const command = "ls <multihash> [--path=apps]"
export const desc = "Print app action log"
export const builder = (yargs) => {
	yargs
		.positional("multihash", {
			describe: "Hash of the spec from IPFS",
			type: "string",
			demandOption: true,
		})
		.option("path", {
			describe: "Path of the app data directory",
			type: "string",
			default: "./apps",
		})
}

export async function handler(args) {
	const appPath = path.resolve(args.path, args.multihash)
	if (!fs.existsSync(appPath)) {
		console.log("App not found")
		process.exit(1)
	}

	const hypercorePath = path.resolve(appPath, "hypercore")
	if (!fs.existsSync(hypercorePath)) {
		console.log("App initialized, but no hypercore found. Have you tried running the app yet?")
		process.exit(1)
	}

	const feed = hypercore(hypercorePath, { createIfMissing: false })
	const db = new HyperBee(feed, { keyEncoding: "utf-8", valueEncoding: "utf-8" })
	await db.ready()

	console.log("Listing actions...")
	for await (const [_, value] of createPrefixStream(db, "a:")) {
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
