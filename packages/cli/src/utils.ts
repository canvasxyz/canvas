import fs from "node:fs"
import path from "node:path"
import process from "node:process"

import { bytesToHex } from "@noble/hashes/utils"
import { sha256 } from "@noble/hashes/sha256"
import chalk from "chalk"
import prompts from "prompts"

import { Canvas } from "@canvas-js/core"

export const CONTRACT_FILENAME = "contract.canvas.js"
export const ORIGINAL_CONTRACT_FILENAME = "contract.original.js"
export const MANIFEST_FILENAME = "canvas.json"

export async function getContractLocation(args: {
	path: string
	topic?: string
	init?: string
	memory?: boolean
}): Promise<{
	topic: string
	originalContract: string
	contract: string
	location: string | null
}> {
	const location = path.resolve(args.path)
	const contractPath = path.resolve(location, CONTRACT_FILENAME)
	const manifestPath = path.resolve(location, MANIFEST_FILENAME)
	const originalContractPath = path.resolve(location, ORIGINAL_CONTRACT_FILENAME)

	// Create the contract location only if --init is specified and the location
	// doesn't already exist.
	if (!fs.existsSync(location)) {
		if (!location.endsWith(".js") && !location.endsWith(".ts") && args.init) {
			if (args.topic === undefined) {
				console.error(chalk.yellow(`--topic is required upon initialization`))
				process.exit(1)
			}

			console.log(`[canvas] Creating application directory ${location}`)
			fs.mkdirSync(location)
			console.log(`[canvas] Copying ${args.init} to ${contractPath}`)
			if (args.init.endsWith(".js")) {
				fs.copyFileSync(args.init, contractPath)
				fs.copyFileSync(args.init, originalContractPath)
			} else {
				const { contract: contractText, originalContract } = await Canvas.buildContract(args.init)
				console.log(chalk.yellow("[canvas] Bundled .ts contract:"), `${contractText.length} chars`)
				fs.writeFileSync(contractPath, contractText)
				fs.copyFileSync(args.init, originalContractPath)
			}
			console.log(`[canvas] Creating ${manifestPath}`)
			fs.writeFileSync(manifestPath, JSON.stringify({ version: 1, topic: args.topic }, null, "  "))
		} else {
			console.error(chalk.yellow(`${location} does not exist.`))
			console.error(chalk.yellow(`Try initializing a new app with \`canvas init ${path.relative(".", location)}\``))
			process.exit(1)
		}
	}

	const stat = fs.statSync(location)
	if (stat.isDirectory()) {
		// Handle if the location exists and it's a directory.
		if (!fs.existsSync(contractPath)) {
			console.error(chalk.yellow(`No contract found at ${contractPath}`))
			console.error(chalk.yellow(`Initialize an example contract with \`canvas init ${path.relative(".", location)}\``))
			process.exit(1)
		}

		if (!fs.existsSync(manifestPath)) {
			if (args.topic !== undefined) {
				console.log(`[canvas] Creating ${manifestPath}`)
				fs.writeFileSync(manifestPath, JSON.stringify({ version: 1, topic: args.topic }))
			} else {
				console.error(chalk.yellow(`No manfiest found at ${manifestPath}`))
				process.exit(1)
			}
		}

		const contract = fs.readFileSync(contractPath, "utf-8")
		const manifest = fs.readFileSync(manifestPath, "utf-8")
		const originalContract = fs.readFileSync(originalContractPath, "utf-8")
		const { topic } = JSON.parse(manifest) as { topic: string }
		return { topic, contract, originalContract, location: args.memory ? null : location }
	} else if (location.endsWith(".js") || location.endsWith(".ts")) {
		// Handle if the location exists and it's a file.
		let contract = fs.readFileSync(location, "utf-8")
		const originalContract = contract

		if (location.endsWith(".ts")) {
			contract = (await Canvas.buildContract(location)).contract
			console.log(chalk.yellow("[canvas] Bundled .ts contract:"), `${contract.length} chars`)
		}

		const topic = args.topic ?? `${bytesToHex(sha256(contract)).slice(0, 16)}.p2p.app`
		if (args.topic === undefined) {
			console.error(chalk.yellow(`[canvas] No --topic provided, using:`), topic)
		}

		return { topic, contract, originalContract, location: null }
	} else {
		console.error(chalk.yellow(`Contract files must match *.js or *.ts`))
		process.exit(1)
	}
}

export async function confirmOrExit(message: string) {
	const { confirm } = await prompts({ type: "confirm", name: "confirm", message: chalk.yellow(message) })

	if (!confirm) {
		console.error("[canvas] Cancelled.")
		process.exit(1)
	}
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
