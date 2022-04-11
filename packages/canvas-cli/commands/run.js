import fs from "node:fs"
import path from "node:path"

import { App } from "canvas-core"

export const command = "run <multihash> [--path=apps] [--peer=localhost:9000/abc...] [--noserver]"
export const desc = "Launch a Canvas app"

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
	const appPath = path.resolve(args.path, args.multihash)
	await App.initialize({
		multihash: args.multihash,
		path: appPath,
		port: args.port,
		peers: [args.peer],
		noServer: args.noserver,
	})
}
