import fs from "node:fs"
import path from "node:path"
import process from "node:process"

import chalk from "chalk"
import prompts from "prompts"

export const CONTRACT_FILENAME = "contract.canvas.js"
export const MANIFEST_FILENAME = "canvas.json"

export function getContractLocation(args: { path: string; topic?: string; init?: string; memory?: boolean }): {
	topic: string
	contract: string
	location: string | null
} {
	const location = path.resolve(args.path)
	const contractPath = path.resolve(location, CONTRACT_FILENAME)
	const manifestPath = path.resolve(location, MANIFEST_FILENAME)

	if (!fs.existsSync(location)) {
		if (!location.endsWith(".canvas.js") && args.init) {
			if (args.topic === undefined) {
				console.error(chalk.yellow(`--topic is required upon initialization`))
				process.exit(1)
			}

			console.log(`[canvas] Creating application directory ${location}`)
			fs.mkdirSync(location)
			console.log(`[canvas] Copying ${args.init} to ${contractPath}`)
			fs.copyFileSync(args.init, contractPath)
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
		const { topic } = JSON.parse(manifest) as { topic: string }
		return { topic, contract, location: args.memory ? null : location }
	} else if (location.endsWith(".canvas.js")) {
		if (args.topic === undefined) {
			console.error(chalk.yellow(`--topic is required for in-memory apps`))
			process.exit(1)
		}

		const contract = fs.readFileSync(location, "utf-8")
		return { topic: args.topic, contract, location: null }
	} else {
		console.error(chalk.yellow(`Contract files must match *.canvas.js`))
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
