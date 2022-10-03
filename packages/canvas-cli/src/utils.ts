import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import process from "node:process"

import chalk from "chalk"
import prompts from "prompts"
import { fetch } from "undici"

import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from "@libp2p/peer-id-factory"
import type { PeerId } from "@libp2p/interface-peer-id"

import { Chain } from "@canvas-js/interfaces"
import { chainType, ModelStore, PostgresStore, SqliteStore } from "@canvas-js/core"

export const SPEC_FILENAME = "spec.canvas.js"

export const CANVAS_HOME = process.env.CANVAS_HOME ?? path.resolve(os.homedir(), ".canvas")

if (!fs.existsSync(CANVAS_HOME)) {
	console.log(`[canvas-cli] Creating directory ${path.resolve(CANVAS_HOME)}`)
	console.log("[canvas-cli] Override this path by setting a CANVAS_HOME environment variable.")
	fs.mkdirSync(CANVAS_HOME)
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
	peerId: PeerId | undefined
}

export async function locateSpec(name: string, ipfsGatewayURL: string): Promise<LocateSpecResult> {
	let peerId: PeerId | undefined
	if (cidPattern.test(name)) {
		const directory = path.resolve(CANVAS_HOME, name)

		const peerIdPath = path.resolve(CANVAS_HOME, "peer.id")
		if (fs.existsSync(peerIdPath)) {
			peerId = await createFromProtobuf(fs.readFileSync(peerIdPath))
			console.log(`[canvas-cli] Found existing PeerId at ${peerIdPath}`)
		} else {
			peerId = await createEd25519PeerId()
			fs.writeFileSync(peerIdPath, exportToProtobuf(peerId))
			console.log(`[canvas-cli] Created new PeerId at ${peerIdPath}`)
		}

		const specPath = path.resolve(CANVAS_HOME, name, SPEC_FILENAME)
		if (fs.existsSync(specPath)) {
			const spec = fs.readFileSync(specPath, "utf-8")
			return { name, directory, spec, peerId }
		} else {
			if (!fs.existsSync(directory)) {
				console.log(`[canvas-cli] Creating directory ${directory}`)
				fs.mkdirSync(directory)
			}

			const spec = await download(name, ipfsGatewayURL)
			fs.writeFileSync(specPath, spec)
			console.log(`[canvas-cli] Downloaded spec to ${specPath}`)
			return { name, directory, spec, peerId }
		}
	} else if (name.endsWith(".js")) {
		const specPath = path.resolve(name)
		const spec = fs.readFileSync(specPath, "utf-8")
		return { name: specPath, directory: null, spec, peerId }
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

function download(cid: string, ipfsGatewayURL: string) {
	const url = `${ipfsGatewayURL}/ipfs/${cid}`
	console.log(`[canvas-cli] Attempting to download spec from IPFS gateway...`)
	console.log(`[canvas-cli] GET ${url}`)
	return fetch(url, { method: "GET" })
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

export function getModelStore(
	databaseURI: string | undefined,
	directory: string | null,
	options: { verbose?: boolean }
): ModelStore {
	if (databaseURI !== undefined) {
		if (databaseURI.startsWith(fileURIPrefix)) {
			return new SqliteStore(databaseURI.slice(fileURIPrefix.length))
		} else if (databaseURI.startsWith(postgresURIPrefix)) {
			return new PostgresStore(databaseURI, options)
		} else {
			throw new Error("invalid database URI")
		}
	} else {
		return new SqliteStore(directory && path.resolve(directory, SqliteStore.DATABASE_FILENAME))
	}
}
