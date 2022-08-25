import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import process from "node:process"

import fetch from "node-fetch"
import chalk from "chalk"
import Knex from "knex"

import prompts from "prompts"

export const SPEC_FILENAME = "spec.canvas.js"

export async function confirm(message) {
	const { confirm } = await prompts({ type: "confirm", name: "confirm", message })

	if (!confirm) {
		console.log("[canvas-cli] Cancelled.")
		process.exit(1)
	}
}

export async function deleteDatabase(directory, { prompt } = {}) {
	const databasePath = path.resolve(directory, Store.DATABASE_FILENAME)
	if (fs.existsSync(databasePath)) {
		if (prompt) {
			const { confirm } = await prompts({
				type: "confirm",
				name: "confirm",
				message: `${chalk.yellow(`Do you want to ${chalk.bold("erase all data")} in ${directory}?`)}`,
			})

			if (!confirm) {
				console.log("[canvas-cli] Cancelled.")
				process.exit(1)
			}
		}

		console.log(`[canvas-cli] Deleting ${databasePath}`)
		fs.rmSync(databasePath)
	}
}

export async function deleteGeneratedModels(directory, { prompt } = {}) {
	const databasePath = path.resolve(directory, Store.DATABASE_FILENAME)
	if (fs.existsSync(databasePath)) {
		if (prompt) {
			const { confirm } = await prompts({
				type: "confirm",
				name: "confirm",
				message: `${chalk.yellow(`Do you want to ${chalk.bold("erase the model database")} at ${databasePath}?`)}`,
			})

			if (!confirm) {
				console.log("[canvas-cli] Cancelled.")
				process.exit(1)
			}
		}

		console.log(`[canvas-cli] Clearing generated models from ${databasePath}`)

		const knex = Knex({
			client: "better-sqlite3",
			connection: { filename: databasePath },
			useNullAsDefault: true,
		})

		// list all tables
		// for pg: SELECT tablename FROM pg_tables WHERE schemaname='public'
		// for sqlite3: SELECT name FROM sqlite_master WHERE type='table';
		const tables = await knex.select("name").from("sqlite_master").where("type", "table").orderBy("name")
		const names = tables.map((t) => t.name).filter((t) => !t.startsWith("_") && !t.startsWith("sqlite_"))

		if (names.length > 0) {
			console.log(chalk.green("Dropping model tables & deletion tables for: " + names.join(", ")))
		}

		const dropModelTables = names.map((t) => knex.schema.dropTableIfExists(t))
		const dropDeletionTables = names.map((t) => knex.schema.dropTableIfExists(`_${t}_deleted`))
		const result = await Promise.all(dropModelTables.concat(dropDeletionTables))
		console.log(chalk.green("Dropped " + result.length + " tables"))
	}
}

export const cidPattern = /^Qm[a-zA-Z0-9]{44}$/

export const defaultDataDirectory = process.env.CANVAS_DATA_DIRECTORY ?? path.resolve(os.homedir(), ".canvas")

export async function locateSpec({ spec: name, datadir, ipfs, temp }) {
	if (cidPattern.test(name)) {
		const directory = temp ? null : datadir ? path.resolve(datadir, name) : defaultDataDirectory
		const specPath = path.resolve(datadir, name, SPEC_FILENAME)
		if (fs.existsSync(specPath)) {
			const spec = fs.readFileSync(specPath, "utf-8")
			return { specPath, directory, name, spec, development: false }
		} else {
			const spec = await download(name, ipfs)
			if (!fs.existsSync(path.resolve(datadir, name))) {
				fs.mkdirSync(path.resolve(datadir, name))
			}
			fs.writeFileSync(specPath, spec)
			console.log(`[canvas-cli] Downloaded to ${specPath}`)
			return { specPath, directory, name, spec, development: false }
		}
	} else if (name.endsWith(".js")) {
		const specPath = path.resolve(name)
		const spec = fs.readFileSync(specPath, "utf-8")
		return { specPath, directory: null, name: specPath, spec, development: true }
	} else {
		console.error(chalk.red("[canvas-cli] Spec argument must be a CIDv0 or a path to a local .js file"))
		process.exit(1)
	}
}

export function setupRpcs(args) {
	const rpc = {}
	if (args.chainRpc) {
		for (let i = 0; i < args.chainRpc.length; i += 3) {
			const chain = args.chainRpc[i]
			const chainId = args.chainRpc[i + 1]
			const chainRpc = args.chainRpc[i + 2]
			if (typeof chain !== "string") {
				console.error(`Invalid chain "${chainId}", should be a string e.g. "eth"`)
				return
			}
			if (typeof chainId !== "number") {
				console.error(`Invalid chain id "${chainId}", should be a number e.g. 1`)
				return
			}
			if (typeof chainRpc !== "string") {
				console.error(`Invalid chain rpc "${chainRpc}", should be a url`)
				return
			}
			rpc[chain] = rpc[chain] || {}
			rpc[chain][chainId] = chainRpc
		}
	} else {
		if (process.env.ETH_CHAIN_ID && process.env.ETH_CHAIN_RPC) {
			rpc.eth = {}
			rpc.eth[process.env.ETH_CHAIN_ID] = process.env.ETH_CHAIN_RPC
			console.log(
				`[canvas-cli] Using Ethereum RPC for chain ID ${process.env.ETH_CHAIN_ID}: ${process.env.ETH_CHAIN_RPC}`
			)
		}
	}
	return rpc
}

function download(cid, ipfsURL) {
	console.log(`[canvas-cli] Attempting to download ${cid} from local IPFS node...`)
	return fetch(`${ipfsURL}/api/v0/cat?arg=${cid}`, { method: "POST" })
		.then((res) => res.text())
		.catch((err) => {
			if (err.code === "ECONNREFUSED") {
				console.error(
					chalk.red(
						"[canvas-cli] Could not connect to local IPFS daemon. Try running `ipfs daemon` in another process."
					)
				)
				process.exit(1)
			} else {
				throw err
			}
		})
}

export function getDirectorySize(directory) {
	return fs.readdirSync(directory).reduce((totalSize, name) => {
		const file = path.resolve(directory, name)
		const stat = fs.statSync(file)
		if (stat.isDirectory()) {
			return totalSize + stat.size + getDirectorySize(file)
		} else {
			return totalSize + stat.size
		}
	}, 0)
}
