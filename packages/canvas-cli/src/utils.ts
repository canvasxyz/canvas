import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import process from "node:process"

import fetch from "node-fetch"
import chalk from "chalk"

import t from "io-ts"

import prompts from "prompts"
import { Chain } from "@canvas-js/interfaces"
import { ModelStore, PostgresStore, SqliteStore } from "@canvas-js/core"

const chainType: t.Type<Chain> = t.union([
	t.literal("eth"),
	t.literal("cosmos"),
	t.literal("solana"),
	t.literal("substrate"),
])

export const SPEC_FILENAME = "spec.canvas.js"

export const CANVAS_HOME = process.env.CANVAS_HOME ?? path.resolve(os.homedir(), ".canvas")

if (!fs.existsSync(CANVAS_HOME)) {
	console.log(`[canvas-cli] Creating directory ${path.resolve(CANVAS_HOME)}`)
	console.log("[canvas-cli] Override this path by setting a CANVAS_HOME environment variable.")
	fs.mkdirSync(CANVAS_HOME)
}

export function defaultDatabaseURI(directory: string | null): string | null {
	return directory && `file:${path.resolve(directory, SqliteStore.DATABASE_FILENAME)}`
}

export async function confirmOrExit(message: string) {
	const { confirm } = await prompts({ type: "confirm", name: "confirm", message: chalk.yellow(message) })

	if (!confirm) {
		console.error("[canvas-cli] Cancelled.")
		process.exit(1)
	}
}

export const cidPattern = /^Qm[a-zA-Z0-9]{44}$/

interface LocateSpecResult {
	name: string
	directory: string | null
	spec: string
}

export async function locateSpec(name: string, ipfsAPI?: string): Promise<LocateSpecResult> {
	if (cidPattern.test(name)) {
		const directory = path.resolve(CANVAS_HOME, name)
		const specPath = path.resolve(CANVAS_HOME, name, SPEC_FILENAME)
		if (fs.existsSync(specPath)) {
			const spec = fs.readFileSync(specPath, "utf-8")
			return { name, directory, spec }
		} else if (ipfsAPI !== undefined) {
			if (!fs.existsSync(directory)) {
				console.log(`[canvas-cli] Creating directory ${directory}`)
				fs.mkdirSync(directory)
			}

			const spec = await download(name, ipfsAPI)
			fs.writeFileSync(specPath, spec)
			console.log(`[canvas-cli] Downloaded spec to ${specPath}`)
			return { name, directory, spec }
		} else {
			throw new Error("No IPFS API provided")
		}
	} else if (name.endsWith(".js")) {
		const specPath = path.resolve(name)
		const spec = fs.readFileSync(specPath, "utf-8")
		return { name: specPath, directory: null, spec }
	} else {
		console.error(chalk.red("[canvas-cli] Spec argument must be a CIDv0 or a path to a local .js file"))
		process.exit(1)
	}
}
export function setupRpcs(args?: Array<string | number>): Partial<Record<Chain, Record<string, string>>> {
	const rpcs: Partial<Record<Chain, Record<string, string>>> = {}
	if (args) {
		for (let i = 0; i < args.length; i += 3) {
			const [chain, id, url] = args.slice(i, i + 3)

			if (!chainType.is(chain)) {
				console.error(chalk.red(`[canvas-cli] Invalid chain "${chain}", should be a ${chainType.name}`))
				return {}
			}

			if (typeof id !== "number") {
				console.error(chalk.red(`Invalid chain id "${id}", should be a number e.g. 1`))
				return {}
			}

			if (typeof url !== "string") {
				console.error(chalk.red(`Invalid chain rpc "${url}", should be a url`))
				return {}
			}

			const c = rpcs[chain]
			if (c) {
				c[id] = url
			} else {
				rpcs[chain] = { [id]: url }
			}
		}
	} else {
		if (process.env.ETH_CHAIN_ID && process.env.ETH_CHAIN_RPC) {
			rpcs.eth = {}
			rpcs.eth[process.env.ETH_CHAIN_ID] = process.env.ETH_CHAIN_RPC
			console.log(
				`[canvas-cli] Using Ethereum RPC for chain ID ${process.env.ETH_CHAIN_ID}: ${process.env.ETH_CHAIN_RPC}`
			)
		}
	}
	return rpcs
}

function download(cid: string, ipfsAPI: string) {
	console.log(`[canvas-cli] Attempting to download ${cid} from local IPFS node...`)
	return fetch(`${ipfsAPI}/api/v0/cat?arg=${cid}`, { method: "POST" })
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

export function getDirectorySize(directory: string): number {
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

const fileURIPrefix = "file:"
const postgresURIPrefix = "postgres:"

export function getModelStore(databaseURI: string | null, options: { verbose?: boolean }): ModelStore {
	if (databaseURI === null) {
		return new SqliteStore(null, options)
	} else if (databaseURI.startsWith(fileURIPrefix)) {
		return new SqliteStore(databaseURI.slice(fileURIPrefix.length))
	} else if (databaseURI.startsWith(postgresURIPrefix)) {
		return new PostgresStore(databaseURI, options)
	} else {
		throw new Error("invalid database URI")
	}
}
