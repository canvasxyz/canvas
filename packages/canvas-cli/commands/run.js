import path from "node:path"
import fs from "node:fs"
import cors from "cors"
import express from "express"
import bodyParser from "body-parser"
import { StatusCodes } from "http-status-codes"

import Hash from "ipfs-only-hash"

import { NativeCore, actionType, actionPayloadType, sessionPayloadType } from "canvas-core"

import { defaultDataDirectory, isMultihash, download } from "./utils.js"

export const command = "run <spec>"
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
			default: defaultDataDirectory,
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
	if (!fs.existsSync(args.datadir)) {
		fs.mkdirSync(args.datadir)
	}

	let appPath
	let spec
	if (isMultihash(args.spec)) {
		appPath = path.resolve(args.datadir, args.spec)
		if (fs.existsSync(appPath)) {
			spec = fs.readFileSync(path.resolve(appPath, "spec.mjs"), "utf-8")
		} else {
			console.log("Creating", appPath)
			fs.mkdirSync(appPath)
			console.log("Downloading", args.spec, "from IPFS...")
			spec = await download(args.spec)
			fs.writeFileSync(path.resolve(appPath, "spec.mjs"), spec)
			fs.writeFileSync(path.resolve(appPath, "spec.cid"), args.spec)
		}
	} else {
		spec = fs.readFileSync(args.spec, "utf-8")
		const multihash = await Hash.of(spec)
		appPath = path.resolve(args.datadir, multihash)
		if (!fs.existsSync(appPath)) {
			console.log("Creating", appPath)
			fs.mkdirSync(appPath)
			fs.writeFileSync(path.resolve(appPath, "spec.mjs"), spec)
			fs.writeFileSync(path.resolve(appPath, "spec.cid"), multihash)
		}
	}

	const port = args.port
	const core = await NativeCore.initialize({ spec, dataDirectory: appPath })

	const ACTION_FORMAT_INVALID = "Invalid action format"

	const server = express()
	server.use(cors())
	server.use(bodyParser.json())

	server.get("/", (req, res) => {
		res.json({ multihash: core.multihash })
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
		console.log(`Serving ${core.multihash} on port ${port}:`)
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
