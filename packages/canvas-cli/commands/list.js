import fs from "node:fs"
import path from "node:path"

import { cidPattern, SPEC_FILENAME } from "../utils.js"

export const command = "list"
export const desc = "List all specs in the data directory"

export const builder = (yargs) => {
	yargs.option("datadir", {
		describe: "Path of the app data directory",
		type: "string",
	})
}

export async function handler(args) {
	if (!fs.existsSync(args.datadir)) {
		fs.mkdirSync(args.datadir)
	}

	console.log(`Showing local specs:\n`)
	for (const cid of fs.readdirSync(args.datadir)) {
		if (!cidPattern.test(cid)) {
			console.log(`[canvas-cli] Unknown spec or invalid CIDv0, skipping: ${cid}`)
			continue
		}

		const specPath = path.resolve(args.datadir, cid, SPEC_FILENAME)
		const specStat = fs.existsSync(specPath) ? fs.statSync(specPath) : null

		const databasePath = path.resolve(args.datadir, cid, Store.DATABASE_FILENAME)
		const databaseStat = fs.existsSync(databasePath) ? fs.statSync(databasePath) : null

		console.log(cid)
		console.log(`Spec:     ${specStat?.size ?? "--"} bytes`)
		console.log(`Data:     ${databaseStat?.size ?? "--"} bytes`)
		console.log("")
	}
}
