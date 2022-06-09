import fs from "node:fs"
import path from "node:path"

import hypercore from "hypercore"
import HyperBee from "hyperbee"

import { createPrefixStream } from "../utils/prefixStream.js"

import { defaultDataDirectory, downloadSpec } from "./utils.js"

export const command = "export <spec>"
export const desc = "Export actions and sessions"
export const builder = (yargs) => {
	yargs
		.positional("spec", {
			describe: "Path to spec file, or IPFS hash of spec",
			type: "string",
			demandOption: true,
		})
		.option("datadir", {
			describe: "Path of the app data directory",
			type: "string",
			default: defaultDataDirectory,
		})
}

export async function handler(args) {
	const [appPath, spec] = await downloadSpec(args.spec, args.datadir, args.reset)

	const hypercorePath = path.resolve(appPath, "hypercore")
	if (!fs.existsSync(hypercorePath)) {
		console.log("App initialized, but no action log found.")
		process.exit(1)
	}

	const feed = hypercore(hypercorePath, { createIfMissing: false })
	const db = new HyperBee(feed, { keyEncoding: "utf-8", valueEncoding: "utf-8" })
	await db.ready()

	for await (const [_, value] of createPrefixStream(db, "")) {
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
