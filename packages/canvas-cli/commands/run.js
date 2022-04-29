import path from "node:path"
import cors from "cors"
import express from "express"
import bodyParser from "body-parser"
import { StatusCodes } from "http-status-codes"

import { NativeCore, actionType, actionPayloadType, sessionPayloadType } from "canvas-core"
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
	const { multihash, spec } = await getSpec(args.datadir, args.spec)
	const dataDirectory = path.resolve(args.datadir, multihash)
	const port = args.port

	const core = await NativeCore.initialize({ spec, dataDirectory })

	const ACTION_FORMAT_INVALID = "Invalid action format"

	const server = express()
	server.use(cors())
	server.use(bodyParser.json())

	server.get("/", (req, res) => {
		res.json({ multihash })
		return
	})

	for (const route of Object.keys(core.routes)) {
		server.get(route, (req, res) => {
			const results = core.routeStatements[route].all(req.params)
			res.status(StatusCodes.OK).json(results)
		})
	}

	server.post(`/actions`, async (req, res) => {
		if (!actionType.is(req.body)) {
			console.error(ACTION_FORMAT_INVALID)
			res.status(StatusCodes.BAD_REQUEST).end(ACTION_FORMAT_INVALID)
			return
		}
		await core
			.apply(req.body)
			.then(() => res.status(StatusCodes.OK).end())
			.catch((err) => {
				console.error(err.message)
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(err.message)
			})
	})

	server.post(`/sessions`, async (req, res) => {
		if (!actionType.is(req.body)) {
			console.error(ACTION_FORMAT_INVALID)
			res.status(StatusCodes.BAD_REQUEST).end(ACTION_FORMAT_INVALID)
			return
		}
		await core
			.session(req.body)
			.then(() => res.status(StatusCodes.OK).end())
			.catch((err) => {
				console.error(err.message)
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(err.message)
			})
	})

	server.listen(port, () => {
		console.log(`Serving ${multihash} on port ${port}:`)
		console.log(`└ GET http://localhost:${port}/`)
		Object.keys(core.routes).map((name) => {
			console.log(`└ GET http://localhost:${port}${name}`)
		})
		console.log("└ POST /actions")
		console.log(`  └ { ${Object.keys(actionType.props).join(", ")} }`)
		console.log(`  └ payload: { ${Object.keys(actionPayloadType.props).join(", ")} }`)
		console.log(`  └ calls: [ ${Object.keys(core.actionFunctions).join(", ")} ]`)
		console.log("└ POST /sessions")
		console.log(`  └ { ${Object.keys(actionType.props).join(", ")} }`)
		console.log(`  └ payload: { ${Object.keys(sessionPayloadType.props).join(", ")} }`)
	})
}
