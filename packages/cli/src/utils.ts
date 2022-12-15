import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import process from "node:process"

import type { PeerId } from "@libp2p/interface-peer-id"
import { exportToProtobuf, createFromProtobuf, createEd25519PeerId } from "@libp2p/peer-id-factory"
import Hash from "ipfs-only-hash"
import chalk from "chalk"
import prompts from "prompts"

import { chainType, constants } from "@canvas-js/core"
import { ethers } from "ethers"

export const CANVAS_HOME = process.env.CANVAS_HOME ?? path.resolve(os.homedir(), ".canvas")
export const SOCKET_FILENAME = "daemon.sock"
export const SOCKET_PATH = path.resolve(CANVAS_HOME, SOCKET_FILENAME)

if (!fs.existsSync(CANVAS_HOME)) {
	console.log(`[canvas-cli] Creating directory ${path.resolve(CANVAS_HOME)}`)
	console.log("[canvas-cli] Override this path by setting a CANVAS_HOME environment variable.")
	fs.mkdirSync(CANVAS_HOME)
}

export async function getPeerId(): Promise<PeerId> {
	if (process.env.PEER_ID !== undefined) {
		return createFromProtobuf(Buffer.from(process.env.PEER_ID, "base64"))
	}

	const peerIdPath = path.resolve(CANVAS_HOME, constants.PEER_ID_FILENAME)
	if (fs.existsSync(peerIdPath)) {
		return createFromProtobuf(fs.readFileSync(peerIdPath))
	} else {
		console.log(`[canvas-cli] Creating new PeerID at ${peerIdPath}`)
		const peerId = await createEd25519PeerId()
		fs.writeFileSync(peerIdPath, exportToProtobuf(peerId))
		return peerId
	}
}

export async function confirmOrExit(message: string) {
	const { confirm } = await prompts({ type: "confirm", name: "confirm", message: chalk.yellow(message) })

	if (!confirm) {
		console.error("[canvas-cli] Cancelled.")
		process.exit(1)
	}
}

export const cidPattern = /^Qm[a-zA-Z0-9]{44}$/

export function parseSpecArgument(value: string): { directory: string | null; uri: string; spec: string } {
	if (cidPattern.test(value)) {
		const directory = path.resolve(CANVAS_HOME, value)
		const specPath = path.resolve(directory, constants.SPEC_FILENAME)
		if (fs.existsSync(specPath)) {
			const spec = fs.readFileSync(specPath, "utf-8")
			return { directory, uri: `ipfs://${value}`, spec }
		} else {
			console.error(chalk.red(`[canvas-cli] App ${value} is not installed.`))
			process.exit(1)
		}
	} else if (value.endsWith(".js") || value.endsWith(".jsx")) {
		const specPath = path.resolve(value)
		const spec = fs.readFileSync(specPath, "utf-8")
		return { directory: null, uri: `file://${specPath}`, spec }
	} else {
		console.error(chalk.red("[canvas-cli] Spec argument must be a CIDv0 or a path to a local .js/.jsx file"))
		process.exit(1)
	}
}

export async function installSpec(spec: string): Promise<string> {
	const cid = await Hash.of(spec)
	const directory = path.resolve(CANVAS_HOME, cid)
	if (!fs.existsSync(directory)) {
		console.log(`[canvas-cli] Creating app directory at ${directory}`)
		fs.mkdirSync(directory)
	}

	const specPath = path.resolve(directory, constants.SPEC_FILENAME)
	if (fs.existsSync(specPath)) {
		console.log(`[canvas-cli] ${specPath} already exists`)
	} else {
		console.log(`[canvas-cli] Creating ${specPath}`)
		fs.writeFileSync(specPath, spec, "utf-8")
	}

	return cid
}

export function getProviders(args?: (string | number)[]): Record<string, ethers.providers.JsonRpcProvider> {
	const providers: Record<string, ethers.providers.JsonRpcProvider> = {}

	if (args !== undefined) {
		for (let i = 0; i < args.length; i += 3) {
			const [chain, id, url] = args.slice(i, i + 3)
			if (!chainType.is(chain)) {
				console.log(chalk.red(`[canvas-cli] Invalid chain "${chain}", should be a ${chainType.name}`))
				process.exit(1)
			} else if (typeof id !== "number") {
				console.log(chalk.red(`Invalid chain id "${id}", should be a number e.g. 1`))
				process.exit(1)
			} else if (typeof url !== "string") {
				console.log(chalk.red(`Invalid chain rpc "${url}", should be a url`))
				process.exit(1)
			}

			const key = `${chain}:${id}`
			providers[key] = new ethers.providers.JsonRpcProvider(url)
		}
	} else if (process.env.ETH_CHAIN_ID && process.env.ETH_CHAIN_RPC) {
		const key = `eth:${process.env.ETH_CHAIN_ID}`
		providers[key] = new ethers.providers.JsonRpcProvider(process.env.ETH_CHAIN_RPC)
		console.log(
			`[canvas-cli] Using Ethereum RPC for chain ID ${process.env.ETH_CHAIN_ID}: ${process.env.ETH_CHAIN_RPC}`
		)
	}

	return providers
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
