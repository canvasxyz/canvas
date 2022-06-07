import path from "node:path"
import fs from "node:fs"
import assert from "node:assert"

import ethers from "ethers"
import cors from "cors"
import express from "express"
import bodyParser from "body-parser"
import { StatusCodes } from "http-status-codes"
import prompt from "prompt"
import chalk from "chalk"
import Hash from "ipfs-only-hash"
import * as t from "io-ts"
import Either from "fp-ts/lib/Either.js"

import { getActionSignatureData } from "@canvas-js/interfaces"
import { NativeCore, actionType, actionPayloadType, sessionType } from "@canvas-js/core"

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
		.option("fixtures", {
			type: "string",
			desc: "Path to a JSON file containing an array of action payloads",
		})
		.option("reset", {
			type: "boolean",
			desc: "Reset the action log and model database",
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
			if (args.reset) {
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
			if (args.reset) {
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
	const core = await NativeCore.initialize({ spec, dataDirectory: appPath })

	if (args.fixtures) {
		await applyFixtures(core, args.fixtures)
	}

	const ACTION_FORMAT_INVALID = "Invalid action format"

	const server = express()
	server.use(cors({ exposedHeaders: ["ETag"] }))
	server.use(bodyParser.json())

	server.head("/", (req, res) => {
		res.status(StatusCodes.OK)
		res.header("ETag", `"${core.multihash}"`)
		res.header("Content-Type", "application/json")
		res.end()
	})

	server.get("/", (req, res) => {
		res.header("ETag", `"${core.multihash}"`)
		res.json({ multihash: core.multihash, spec: core.spec })
	})

	for (const route of Object.keys(core.routes)) {
		const parameterNames = core.routeParameters[route]
		server.get(route, (req, res) => {
			const parameterValues = {}
			for (const name of parameterNames) {
				const value = req.params[name]
				if (typeof value === "string") {
					parameterValues[name] = value
				} else {
					res.status(StatusCodes.BAD_REQUEST)
					res.end(`Missing parameter "${name}"`)
					return
				}
			}

			const statement = core.routeStatements[route]
			const accept = req.headers.accept
			if (accept === "text/event-stream") {
				// subscription response
				res.setHeader("Cache-Control", "no-cache")
				res.setHeader("Content-Type", "text/event-stream")
				res.setHeader("Access-Control-Allow-Origin", "*")
				res.setHeader("Connection", "keep-alive")
				res.flushHeaders()

				let data = null
				const listener = () => {
					const newData = statement.all(parameterValues)
					if (data === null || !compareResults(data, newData)) {
						data = newData
						res.write(`data: ${JSON.stringify(data)}\n\n`)
					}
				}

				listener()

				core.addEventListener("action", listener)
				res.on("close", () => {
					core.removeEventListener("action", listener)
				})
			} else {
				// normal JSON response
				const data = statement.all(parameterValues)
				res.status(StatusCodes.OK).json(data)
			}
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
		if (!sessionType.is(req.body)) {
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
		console.log(`  └ payload: { ${Object.keys(sessionType.props.payload.props).join(", ")} }`)
	})
}

const fixturesType = t.array(
	t.type({
		privateKey: t.string,
		call: t.string,
		args: t.array(t.union([t.null, t.number, t.string, t.boolean])),
	})
)

async function applyFixtures(core, fixtures) {
	if (core.feed.length > 0) {
		console.error(
			chalk.red(
				`[canvas-cli]: Found an existing action log in the app directory. Fixtures can only be applied to an empty action log. Re-run in combination with the --reset flag to clear the data in the app directory.`
			)
		)

		await core.close()
		process.exit(1)
	}

	const result = fixturesType.decode(JSON.parse(fs.readFileSync(fixtures, "utf-8")))
	if (Either.isLeft(result)) {
		throw new Error("Invalid fixtures file")
	}

	const timestamp = Math.round(Date.now() / 1000)
	const wallets = new Map()
	for (const [i, { privateKey, call, args }] of result.right.entries()) {
		if (!wallets.has(privateKey)) {
			assert(privateKey.startsWith("0x"))
			const paddedPrivateKey = "0x" + privateKey.slice(2).padStart(64, "0")
			const wallet = new ethers.Wallet(paddedPrivateKey)
			wallets.set(privateKey, wallet)
		}

		const signer = wallets.get(privateKey)
		const from = await signer.getAddress()
		const payload = {
			from,
			spec: core.multihash,
			call,
			args,
			timestamp: timestamp - result.right.length + i,
		}

		const signatureData = getActionSignatureData(payload)
		const signature = await signer._signTypedData(...signatureData)
		await core.apply({ session: null, signature, payload })
	}
}

async function resetAppData(appPath) {
	const hypercorePath = path.resolve(appPath, "hypercore")
	const databasePath = path.resolve(appPath, "db.sqlite")
	if (fs.existsSync(hypercorePath) || fs.existsSync(databasePath)) {
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

// This assumes a and b are both arrays of objects of primitives,
// ie both Record<string, ModelValue>[]
function compareResults(a, b) {
	if (a.length !== b.length) {
		return false
	}

	for (let i = 0; i < a.length; i++) {
		for (const key in a[i]) {
			if (a[i][key] !== b[i][key]) {
				return false
			}
		}

		for (const key in b[i]) {
			if (b[i][key] !== a[i][key]) {
				return false
			}
		}
	}
}
