import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import assert from "node:assert"

import chalk from "chalk"
import prompts from "prompts"

import { SessionSigner } from "@canvas-js/interfaces"

export const CONTRACT_FILENAME = "contract.canvas.js"

export function getContractLocation(args: { path: string; memory?: boolean }): {
	contract: string
	location: string | null
	uri: string
} {
	const location = path.resolve(args.path)

	if (!fs.existsSync(location)) {
		console.error(chalk.yellow(`${location} does not exist.`))
		console.error(chalk.yellow(`Try initializing a new app with \`canvas init ${path.relative(".", location)}\``))
		process.exit(1)
	}

	const stat = fs.statSync(location)
	if (stat.isDirectory()) {
		const contractPath = path.resolve(location, CONTRACT_FILENAME)
		if (!fs.existsSync(contractPath)) {
			console.error(chalk.yellow(`No contract found at ${contractPath}`))
			console.error(chalk.yellow(`Initialize an example contract with \`canvas init ${path.relative(".", location)}\``))
			process.exit(1)
		}

		const contract = fs.readFileSync(contractPath, "utf-8")
		return { contract, location: args.memory ? null : location, uri: `file://${contractPath}` }
	} else if (!location.endsWith(".canvas.js")) {
		console.error(chalk.yellow(`Contract files must match *.canvas.js`))
		process.exit(1)
	} else {
		const contract = fs.readFileSync(location, "utf-8")
		return { contract, location: null, uri: `file://${location}` }
	}
}
// const contractPattern = /^(.*)\.canvas\.js$/

// export function getContractLocation(args: { contract: string; memory?: boolean }): {
// 	location: string | null
// 	contract: string
// } {
// 	const contractPath = path.resolve(args.contract)
// 	const contract = fs.readFileSync(contractPath, "utf-8")
// 	if (args.memory ?? false) {
// 		return { contract, location: null }
// 	}

// 	const result = contractPattern.exec(path.basename(contractPath))
// 	assert(result !== null, "contract filename must match *.canvas.js")
// 	const [_, name] = result

// 	const location = path.resolve(path.dirname(contractPath), `${name}-data`)
// 	return { contract, location }
// }

export const mapEntries = <K extends string, S, T>(object: Record<K, S>, map: (entry: [key: K, value: S]) => T) =>
	Object.fromEntries(Object.entries<S>(object).map(([key, value]) => [key, map([key as K, value])])) as Record<K, T>

export const mapKeys = <K extends string, S, T>(object: Record<K, S>, map: (key: K) => T) =>
	Object.fromEntries(Object.entries<S>(object).map(([key, value]) => [key, map(key as K)])) as Record<K, T>

export const mapValues = <K extends string, S, T>(object: Record<K, S>, map: (value: S) => T) =>
	Object.fromEntries(Object.entries<S>(object).map(([key, value]) => [key, map(value)])) as Record<K, T>

export function signalInvalidType(type: never): never {
	console.error(type)
	throw new TypeError("internal error: invalid type")
}

export async function confirmOrExit(message: string) {
	const { confirm } = await prompts({ type: "confirm", name: "confirm", message: chalk.yellow(message) })

	if (!confirm) {
		console.error("[canvas-cli] Cancelled.")
		process.exit(1)
	}
}

function parseChainId(chain: string): [namespace: string, chainId: string] {
	const namespaceIndex = chain.indexOf(":")
	assert(namespaceIndex > 0, "invalid CAIP-2 chain reference")
	const namespace = chain.slice(0, namespaceIndex)
	return [namespace, chain.slice(namespaceIndex + 1)]
}

export async function getSigners(args?: (string | number)[]): Promise<SessionSigner[]> {
	// const domain = "http://localhost"
	const signers: SessionSigner[] = []

	// // TODO: add a filesystem SessionStore implementation

	// if (args !== undefined) {
	// 	for (const arg of args) {
	// 		if (typeof arg === "number") {
	// 			throw new Error(`invalid --chain argument "${arg}"`)
	// 		}

	// 		const delimiterIndex = arg.indexOf("=")
	// 		if (delimiterIndex === -1) {
	// 			// chain provided without url
	// 			const [namespace, chainId] = parseChainId(arg)
	// 			if (namespace === "eip155") {
	// 				const signer = new SIWESigner({  })
	// 				signers.push(signer)
	// 			} else {
	// 				throw new Error(`Unsupported chain ${arg}`)
	// 			}
	// 		} else {
	// 			// chain provided with url
	// 			const chain = arg.slice(0, delimiterIndex)
	// 			// const url = arg.slice(delimiterIndex + 1)
	// 			const [namespace, chainId] = parseChainId(chain)
	// 			if (namespace === "eip155") {
	// 				// const provider = new ethers.JsonRpcProvider(url)
	// 				const signer = await SIWESigner.init({ chain: chainId })
	// 				signers.push(signer)
	// 			} else {
	// 				throw new Error(`Unsupported chain ${arg}: only eip155 chains can be passed in the CLI with RPCs`)
	// 			}
	// 		}
	// 	}
	// } else if (process.env.ETH_CHAIN_ID && process.env.ETH_CHAIN_RPC) {
	// 	const chainId = process.env.ETH_CHAIN_ID
	// 	const signer = await SIWESigner.init({ chain: chainId })
	// 	signers.push(signer)
	// 	// const provider = new ethers.providers.JsonRpcProvider(process.env.ETH_CHAIN_RPC)
	// 	// chains.push(new EthereumChainImplementation(chainId, domain, provider))
	// 	// console.log(
	// 	// 	`[canvas-cli] Using Ethereum RPC for chain ID ${process.env.ETH_CHAIN_ID}: ${process.env.ETH_CHAIN_RPC}`
	// 	// )
	// } else {
	// 	const signer = await SIWESigner.init({})
	// 	signers.push(signer)
	// }

	return signers
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
