import path from "node:path"
import fs from "node:fs"

import cors from "cors"
import express from "express"
import bodyParser from "body-parser"
import { StatusCodes } from "http-status-codes"
import prompt from "prompt"
import chalk from "chalk"
import Hash from "ipfs-only-hash"
import * as t from "io-ts"
import Either from "fp-ts/lib/Either.js"

import { NativeCore, actionType, actionPayloadType, sessionType, sessionPayloadType } from "canvas-core"

import { defaultDataDirectory, isMultihash, download } from "./utils.js"

export const command = "run <spec>"
export const desc = "Run an app, by path or multihash"

const fixturesType = t.array(
	t.type({
		from: t.string,
		call: t.string,
		args: t.array(t.union([t.null, t.number, t.string, t.boolean])),
	})
)

async function resetAppData(appPath) {
	const hypercorePath = path.resolve(appPath, "hypercore")
	const databasePath = path.resolve(appPath, "db.sqlite")
	if (fs.existsSync(hypercorePath) || fs.existsSync(databasePath)) {
		console.log(
			`[canvas-cli]: Found an existing action log in the app directory. Fixtures can only be applied to an empty action log.`
		)
		const { reset } = await prompt.get({
			name: "reset",
			description: `${chalk.yellow(`Do you want to ${chalk.bold("erase all data")} in ${appPath}?`)} [yN]`,
			message: "Invalid input.",
			type: "string",
			required: true,
			pattern: /^[yn]?$/i,
		})

		if (reset.toLowerCase() === "y") {
			console.log(`[canvas-cli]: Removing ${hypercorePath}`)
			fs.rmSync(hypercorePath, { recursive: true, force: true })
			console.log(`[canvas-cli]: Removing ${databasePath}`)
			fs.rmSync(databasePath, { recursive: true, force: true })
		} else {
			console.log("[canvas-cli]: Cancelled.")
			process.exit(1)
		}
	}
}

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
		.option("fixtures", {
			type: "string",
			desc: "Path to a JSON file containing an array of action payloads",
		})
}

export async function handler(args) {
	if (!fs.existsSync(args.datadir)) {
		fs.mkdirSync(args.datadir)
	}

	prompt.message = "[canvas-cli]"
	prompt.start()

	let appPath
	let spec
	if (isMultihash(args.spec)) {
		appPath = path.resolve(args.datadir, args.spec)
		if (fs.existsSync(appPath)) {
			spec = fs.readFileSync(path.resolve(appPath, "spec.mjs"), "utf-8")
			if (args.fixtures) {
				await resetAppData(appPath)
			}
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
		if (fs.existsSync(appPath)) {
			if (args.fixtures) {
				await resetAppData(appPath)
			}
		} else {
			console.log("Creating", appPath)
			fs.mkdirSync(appPath)
			fs.writeFileSync(path.resolve(appPath, "spec.mjs"), spec)
			fs.writeFileSync(path.resolve(appPath, "spec.cid"), multihash)
		}
	}

	const port = args.port
	const core = await NativeCore.initialize({
		spec,
		dataDirectory: appPath,
	})

	if (args.fixtures) {
		const result = fixturesType.decode(JSON.parse(fs.readFileSync(args.fixtures, "utf-8")))
		if (Either.isLeft(result)) {
			throw new Error("Invalid fixtures file.")
		}
		const timestamp = Math.round(Date.now() / 1000)
		for (const [i, { from, call, args }] of result.right.entries()) {
			const payload = { from, spec: core.multihash, call, args, timestamp: timestamp - result.right.length + i }
			await core.apply(
				{ from, session: null, signature: null, payload: JSON.stringify(payload) },
				{ skipSignatureVerification: true }
			)
		}
	}

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
		console.log(`  └ { ${Object.keys(sessionType.props).join(", ")} }`)
		console.log(`  └ payload: { ${Object.keys(sessionPayloadType.props).join(", ")} }`)
	})
}
