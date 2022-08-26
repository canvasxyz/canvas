import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import process from "node:process"

import fetch from "node-fetch"
import chalk from "chalk"

import prompts from "prompts"

export const SPEC_FILENAME = "spec.canvas.js"

export async function confirmOrExit(message) {
	const { confirm } = await prompts({ type: "confirm", name: "confirm", message: chalk.yellow(message) })

	if (!confirm) {
		console.error("[canvas-cli] Cancelled.")
		process.exit(1)
	}
}

export const defaultDataDirectory = process.env.CANVAS_DATA_DIRECTORY ?? path.resolve(os.homedir(), ".canvas")

export const cidPattern = /^Qm[a-zA-Z0-9]{44}$/

export async function locateSpec({ spec: name, datadir, ipfs: ipfsAPI }) {
	if (cidPattern.test(name)) {
		const directory = path.resolve(datadir, name)
		const specPath = path.resolve(datadir, name, SPEC_FILENAME)
		if (fs.existsSync(specPath)) {
			const spec = fs.readFileSync(specPath, "utf-8")
			return { name, directory, specPath, spec }
		} else {
			if (!fs.existsSync(directory)) {
				console.log(`[canvas-cli] Creating directory ${directory}`)
				fs.mkdirSync(directory)
			}

			fs.writeFileSync(specPath, await download(name, ipfsAPI))
			console.log(`[canvas-cli] Downloaded spec to ${specPath}`)
			return { name, directory, specPath, spec }
		}
	} else if (name.endsWith(".js")) {
		const specPath = path.resolve(name)
		const spec = fs.readFileSync(specPath, "utf-8")
		return { name: specPath, directory: null, specPath, spec }
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

function download(cid, ipfsAPI) {
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
