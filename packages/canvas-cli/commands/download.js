import fs from "node:fs"
import path from "node:path"

import { defaultDataDirectory, download } from "./utils.js"

export const command = "download <multihash>"
export const desc = "Download an app to the data directory"
export const builder = (yargs) => {
	yargs
		.positional("multihash", {
			describe: "Hash of the spec from IPFS",
			type: "string",
			demandOption: true,
		})
		.option("datadir", {
			describe: "Path of the canvas data directory",
			type: "string",
			default: defaultDataDirectory,
		})
}

export async function handler(args) {
	if (!fs.existsSync(args.datadir)) {
		console.log("Created", args.datadir)
		fs.mkdirSync(args.datadir)
	}

	const appPath = path.resolve(args.datadir, args.multihash)
	if (fs.existsSync(appPath)) {
		console.error("App already exists at " + appPath)
		process.exit(1)
	}

	fs.mkdirSync(appPath)

	const spec = await download(args.multihash)
	fs.writeFileSync(path.resolve(appPath, "spec.cid"), args.multihash)
	fs.writeFileSync(path.resolve(appPath, "spec.mjs"), spec)
	console.log(`Downloaded app at ${appPath}`)
}
