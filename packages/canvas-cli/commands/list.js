import * as listActions from "./listActions.js"
import * as listSessions from "./listSessions.js"

import fs from "fs"
import path from "node:path"

export const command = "list [--datadir=apps]"
export const desc = "List all specs in the data directory."

export const builder = (yargs) => {
	yargs
		.option("datadir", {
			describe: "Path of the app data directory",
			type: "string",
			default: "./apps",
		})
		.command([listActions, listSessions])
}

export async function handler(args) {
	const dir = fs.opendirSync(args.datadir)
	console.log(`Showing local specs:
`)

	while (true) {
		const dirent = await dir.read()
		if (dirent === null) break

		if (!dirent.name.startsWith("Qm")) {
			console.log(`Unknown spec or invalid multihash, skipping: ${dirent.name}`)
			continue
		}

		// get spec info, hypercore info
		// TODO: we shouldn't have to read the whole file...
		const multihash = dirent.name
		let spec, db, hyp
		try {
			spec = fs.readFileSync(path.join(args.datadir, multihash, "spec.mjs"))
		} catch (err) {}
		try {
			db = fs.readFileSync(path.join(args.datadir, multihash, "db.sqlite"))
		} catch (err) {}
		try {
			// TODO: get directory size
			hyp = fs.opendirSync(path.join(args.datadir, multihash, "hypercore"))
		} catch (err) {}
		console.log(multihash)
		console.log(`Spec: ${spec?.length || "--"} bytes`)
		console.log(`Models: ${db?.length || "--"} bytes`)
		console.log(`Action Log: ${hyp?.bufferSize || "--"} bytes`)
		console.log("")
	}
	console.log(`Try "canvas info", "canvas list actions", or
"canvas list sessions" for more information on a spec.
`)
}
