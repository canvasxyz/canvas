import path from "node:path"

import { NativeCore } from "canvas-core"
import { getSpec } from "./utils.js"

export const command = "run <spec> [--datadir=apps] [--peer=localhost:9000/abc...] [--noserver]"
export const desc = "Run an app, by path or multihash"

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
	const { multihash, spec } = await getSpec(args.spec)
	const datadir = path.resolve(args.datadir, multihash)

	const core = await NativeCore.initialize(multihash, spec, {
		directory: datadir,
		port: args.port,
		peers: [args.peer],
	})

	console.log("should start server")
	// TODO!

	// serve GET /[multihash]

	// serve POST /[multihash]/actions
	// if (typeof req.query.multihash !== "string") {
	// 	return res.status(StatusCodes.BAD_REQUEST).end()
	// }

	// if (!actionType.is(req.body)) {
	// 	return res.status(StatusCodes.BAD_REQUEST).end()
	// }

	// const app = loader.apps.get(req.query.multihash)
	// if (app === undefined) {
	// 	return res.status(StatusCodes.NOT_FOUND).end()
	// }

	// await app
	// 	.apply(req.body)
	// 	.then(() => res.status(StatusCodes.OK).end())
	// 	.catch((err) => res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(err.message))
}
