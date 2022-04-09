import fs from "node:fs"
import path from "node:path"

import { create as createIPFSHTTPClient } from "ipfs-http-client"

export const command = "init <path>"
export const desc = "Initialize a Canvas app"
export const builder = (yargs) => {
	yargs
		.positional("path", {
			describe: "Path of the app data directory",
			type: "string",
		})
		.option("cid", { type: "string", demandOption: true, desc: "Hash of the spec to fetch from IPFS" })
}

export async function handler(args) {
	const ipfs = createIPFSHTTPClient()

	const appPath = path.resolve(args.path)
	if (fs.existsSync(appPath)) {
		throw new Error("path already exists")
	}

	fs.mkdirSync(appPath)
	await fs.promises.writeFile(path.resolve(appPath, "spec.mjs"), ipfs.cat(args.cid))
	await fs.promises.writeFile(path.resolve(appPath, "spec.cid"), args.cid)
	console.log(`Initialized app ${args.cid} in ${appPath}/*`)
}
