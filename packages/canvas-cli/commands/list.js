import fs from "fs"
import path from "node:path"

import { defaultDataDirectory, getDirectorySize, isMultihash } from "./utils.js"

export const command = "list"
export const desc = "List all specs in the data directory"

export const builder = (yargs) => {
	yargs.option("datadir", {
		describe: "Path of the app data directory",
		type: "string",
		default: defaultDataDirectory,
	})
}

export async function handler(args) {
	if (!fs.existsSync(args.datadir)) {
		fs.mkdirSync(args.datadir)
	}

	console.log(`Showing local specs:\n`)
	for (const multihash of fs.readdirSync(args.datadir)) {
		if (!isMultihash(multihash)) {
			console.log(`Unknown spec or invalid multihash, skipping: ${multihash}`)
			continue
		}

		const specPath = path.resolve(args.datadir, multihash, "spec.mjs")
		const specStat = fs.existsSync(specPath) ? fs.statSync(specPath) : null

		const databasePath = path.resolve(args.datadir, multihash, "db.sqlite")
		const databaseStat = fs.existsSync(databasePath) ? fs.statSync(databasePath) : null

		const hypercorePath = path.resolve(args.datadir, multihash, "hypercore")
		const hypercoreSize = fs.existsSync(hypercorePath) ? getDirectorySize(hypercorePath) : null

		console.log(multihash)
		console.log(`Spec:       ${specStat?.size ?? "--"} bytes`)
		console.log(`Models:     ${databaseStat?.size ?? "--"} bytes`)
		console.log(`Action log: ${hypercoreSize ?? "--"} bytes`)
		console.log("")
	}
}
