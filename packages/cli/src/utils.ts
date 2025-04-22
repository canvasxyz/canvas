import fs from "node:fs"
import path from "node:path"
import process from "node:process"

import * as cbor from "@ipld/dag-cbor"
import { bytesToHex } from "@noble/hashes/utils"
import { sha256 } from "@noble/hashes/sha256"
import chalk from "chalk"
import prompts from "prompts"

import { Canvas, Snapshot } from "@canvas-js/core"

export const ORIGINAL_CONTRACT_FILENAME = "contract.canvas.js"
export const BUNDLED_CONTRACT_FILENAME = "contract.build.js"
export const MANIFEST_FILENAME = "canvas.json"
export const SNAPSHOT_FILENAME = "snapshot.bin"
export const DB_FILENAME = "db.sqlite"

export function writeContract(args: { location: string; baseTopic: string; originalContract: string; build: string }) {
	const location = args.location
	const contractPath = path.resolve(location, BUNDLED_CONTRACT_FILENAME)
	const originalContractPath = path.resolve(location, ORIGINAL_CONTRACT_FILENAME)
	const manifestPath = path.resolve(location, MANIFEST_FILENAME)

	console.log(`[canvas] Overwriting ${contractPath}`)
	fs.writeFileSync(contractPath, args.build)

	console.log(`[canvas] Overwriting ${originalContractPath}`)
	fs.writeFileSync(originalContractPath, args.originalContract)

	console.log(`[canvas] Overwriting ${manifestPath}`)
	fs.writeFileSync(manifestPath, JSON.stringify({ version: 1, topic: args.baseTopic }, null, "  "))
}

export async function writeSnapshot(args: { location: string; snapshot: Snapshot }) {
	const location = args.location
	const snapshotPath = path.resolve(location, SNAPSHOT_FILENAME)

	console.log(`[canvas] Overwriting ${snapshotPath}`)
	const encoded = cbor.encode(args.snapshot)

	await new Promise((resolve) => fs.writeFile(snapshotPath, encoded, resolve))
}

export function clearSnapshot(args: { location: string }) {
	const location = args.location
	const snapshotPath = path.resolve(location, SNAPSHOT_FILENAME)

	console.log(`[canvas] Removing snapshot at ${snapshotPath}`)
	try {
		fs.unlinkSync(snapshotPath)
	} catch (err) {
		console.error(err)
	}
}

export function clearContractLocationDB(args: { location: string }) {
	const sqlitePath = path.resolve(args.location, DB_FILENAME)
	try {
		fs.unlinkSync(sqlitePath)
	} catch (err) {
		console.error(err)
	}
}

async function buildContract(originalContractPath: string, bundledContractPath: string) {
	if (originalContractPath.endsWith(".js")) {
		fs.copyFileSync(originalContractPath, bundledContractPath)
	} else {
		const { build: contractText, originalContract } = await Canvas.buildContractByLocation(originalContractPath)
		console.log(chalk.yellow("[canvas] Bundled .ts contract:"), `${contractText.length} chars`)
		fs.writeFileSync(bundledContractPath, contractText)
	}
}

export async function getContractLocation(args: {
	path: string
	baseTopic?: string
	init?: string
	memory?: boolean
}): Promise<{
	baseTopic: string
	originalContract: string
	contract: string
	location: string | null
	snapshot?: Snapshot | null | undefined
}> {
	const location = path.resolve(args.path)
	const bundledContractPath = path.resolve(location, BUNDLED_CONTRACT_FILENAME)
	const originalContractPath = path.resolve(location, ORIGINAL_CONTRACT_FILENAME)
	const manifestPath = path.resolve(location, MANIFEST_FILENAME)
	const snapshotPath = path.resolve(location, SNAPSHOT_FILENAME)

	// Create the contract location only if --init is specified and the location
	// doesn't already exist.
	if (!fs.existsSync(location)) {
		if (!location.endsWith(".js") && !location.endsWith(".ts") && args.init) {
			if (args.baseTopic === undefined) {
				console.error(chalk.yellow(`--topic is required upon initialization`))
				process.exit(1)
			}
			if (args.baseTopic.indexOf("#") !== -1) {
				console.error(chalk.yellow(`--topic must be provided *without* a hash`))
				process.exit(1)
			}
			console.log(`[canvas] Creating application directory ${location}`)
			fs.mkdirSync(location)
			console.log(`[canvas] Copying ${args.init} to ${originalContractPath}`)
			fs.copyFileSync(args.init, originalContractPath)
			console.log(`[canvas] Building ${args.init} to ${bundledContractPath}`)
			await buildContract(args.init, bundledContractPath)
			console.log(`[canvas] Creating ${manifestPath}`)
			fs.writeFileSync(manifestPath, JSON.stringify({ version: 1, topic: args.baseTopic }, null, "  "))
		} else {
			console.error(chalk.yellow(`${location} does not exist.`))
			process.exit(1)
		}
	}

	const stat = fs.statSync(location)
	if (stat.isDirectory()) {
		// Handle if the location exists and it's a directory.
		if (!fs.existsSync(originalContractPath)) {
			console.error(chalk.yellow(`No contract found at ${originalContractPath}`))
			process.exit(1)
		}

		if (!fs.existsSync(bundledContractPath)) {
			console.error(chalk.yellow(`No contract found at ${bundledContractPath}, rebuilding`))
			await buildContract(originalContractPath, bundledContractPath)
		}

		if (!fs.existsSync(manifestPath)) {
			if (args.baseTopic !== undefined && args.baseTopic.indexOf("#") !== -1) {
				console.error(chalk.yellow(`--topic must be provided *without* a hash`))
				process.exit(1)
			}
			if (args.baseTopic !== undefined) {
				console.log(`[canvas] Creating ${manifestPath}`)
				fs.writeFileSync(manifestPath, JSON.stringify({ version: 1, topic: args.baseTopic }))
			} else {
				console.error(chalk.yellow(`No manifest found at ${manifestPath}`))
				process.exit(1)
			}
		}

		const originalContract = fs.readFileSync(originalContractPath, "utf-8")
		const contract = fs.readFileSync(bundledContractPath, "utf-8")
		const manifest = fs.readFileSync(manifestPath, "utf-8")
		const { topic: baseTopic } = JSON.parse(manifest) as { topic: string }
		const snapshot = fs.existsSync(snapshotPath) ? cbor.decode<Snapshot>(fs.readFileSync(snapshotPath)) : null

		return { baseTopic, contract, originalContract, location: args.memory ? null : location, snapshot }
	} else if (location.endsWith(".js") || location.endsWith(".ts")) {
		// Handle if the location exists and it's a file.
		let contract = fs.readFileSync(location, "utf-8")
		const originalContract = contract

		if (location.endsWith(".ts")) {
			contract = (await Canvas.buildContractByLocation(location)).build
			console.log(chalk.yellow("[canvas] Bundled .ts contract:"), `${contract.length} chars`)
		}

		const baseTopic = args.baseTopic ?? `${bytesToHex(sha256(contract)).slice(0, 16)}.p2p.app`
		if (args.baseTopic !== undefined && args.baseTopic.indexOf("#") !== -1) {
			console.error(chalk.yellow(`--topic must be provided *without* a hash`))
			process.exit(1)
		}
		if (args.baseTopic === undefined) {
			console.error(chalk.yellow(`[canvas] No --topic provided, using:`), baseTopic)
		}

		return { baseTopic, contract, originalContract, location: null }
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
