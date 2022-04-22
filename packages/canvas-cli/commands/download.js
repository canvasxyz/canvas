import fs from "node:fs"
import path from "node:path"

import * as IpfsHttpClient from "ipfs-http-client"

export const command = "download <multihash> [--path=apps]"
export const desc = "Download an app, by multihash"
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
	const ipfs = await IpfsHttpClient.create()
	const chunks = []
	try {
		for await (const chunk of ipfs.cat(args.multihash)) {
			chunks.push(chunk)
		}
	} catch (err) {
		if (err.message.indexOf("ECONNREFUSED") !== -1) {
			console.log("Could not connect to local IPFS daemon, try: ipfs daemon --offline")
		}
		return
	}

	const spec = Buffer.concat(chunks).toString("utf-8")

	if (!fs.existsSync(args.datadir)) {
		console.log("Created " + args.datadir)
		fs.mkdirSync(args.datadir)
	}

	const datadir = path.resolve(args.datadir, args.multihash)
	if (fs.existsSync(datadir)) {
		console.error("App already exists at " + datadir)
		process.exit(1)
	}

	fs.mkdirSync(datadir)
	await fs.promises.writeFile(path.resolve(datadir, "spec.mjs"), spec)
	await fs.promises.writeFile(path.resolve(datadir, "spec.cid"), args.multihash)
	console.log(`Downloaded app at ${datadir}`)
}
