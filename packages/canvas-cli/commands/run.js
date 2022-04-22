import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

import * as IpfsHttpClient from "ipfs-http-client"
import Hash from "ipfs-only-hash"
import { NativeCore } from "canvas-core"

export const command = "run <spec> [--datadir=apps] [--peer=localhost:9000/abc...] [--noserver]"
export const desc = "Launch a Canvas app"

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
			default: "./apps",
		})
		.option("port", {
			type: "number",
			default: 8000,
			desc: "Port to bind the core API",
		})
		.option("peer", {
			type: "string",
			desc: "Peers to connect to",
		})
		.option("noserver", {
			type: "boolean",
			desc: "Don't bind an Express server to provide view APIs",
		})
}

export async function handler(args) {
	let multihash, spec
	if (args.spec.match(/^Qm[a-zA-Z0-9]+/)) {
		// fetch spec from multihash
		multihash = args.spec

		const chunks = []
		try {
			const ipfs = await IpfsHttpClient.create()
			for await (const chunk of ipfs.cat(multihash)) {
				chunks.push(chunk)
			}
		} catch (err) {
			if (err.message.indexOf("ECONNREFUSED") !== -1) {
				console.log("Could not connect to local IPFS daemon, try: ipfs daemon --offline")
			}
			return
		}
		spec = Buffer.concat(chunks).toString("utf-8")
	} else {
		// read spec from file
		const bytes = fs.readFileSync(args.spec)
		multihash = await Hash.of(bytes)
		spec = bytes.toString()
	}
	const datadir = path.resolve(args.datadir, multihash)

	await NativeCore.initialize({
		multihash,
		spec,
		options: {
			directory: datadir,
			port: args.port,
			peers: [args.peer],
			noServer: args.noserver,
		},
	})
}
