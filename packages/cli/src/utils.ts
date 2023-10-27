import fs from "node:fs"
import path from "node:path"
import process from "node:process"

import chalk from "chalk"
import prompts from "prompts"

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
