import fs from "node:fs"
import path from "node:path"

import { create as createIPFSHTTPClient } from "ipfs-http-client"

export const command = "download <multihash> [--path=apps]"
export const desc = "Download a Canvas app"
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
	const ipfs = createIPFSHTTPClient()
	const spec = ipfs.cat(args.multihash)

	if (!fs.existsSync(args.path)) {
		console.log("Created " + args.path)
		fs.mkdirSync(args.path)
	}

	const appPath = path.resolve(args.path, args.multihash)
	if (fs.existsSync(appPath)) {
		console.error("App already exists at " + appPath)
		process.exit(1)
	}

	fs.mkdirSync(appPath)
	await fs.promises.writeFile(path.resolve(appPath, "spec.mjs"), spec)
	await fs.promises.writeFile(path.resolve(appPath, "spec.cid"), args.multihash)
	console.log(`Downloaded app at ${appPath}`)
}
