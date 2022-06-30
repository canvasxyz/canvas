import assert from "node:assert"
import readline from "node:readline"

import { getQuickJS } from "quickjs-emscripten"
import chalk from "chalk"

import { Core, actionType, sessionType } from "@canvas-js/core"

import { defaultDataDirectory, locateSpec } from "../utils.js"

export const command = "import <spec>"
export const desc = "Import actions and sessions from stdin"
export const builder = (yargs) => {
	yargs
		.positional("spec", {
			describe: "Path to spec file, or CID of spec",
			type: "string",
			demandOption: true,
		})
		.option("datadir", {
			describe: "Path of the app data directory",
			type: "string",
			default: defaultDataDirectory,
		})
		.option("ipfs", {
			type: "string",
			desc: "IPFS HTTP API URL",
			default: "http://localhost:5001",
		})
}

export async function handler(args) {
	const { name, directory, spec, development } = await locateSpec({ ...args, temp: false })

	const quickJS = await getQuickJS()
	const core = await Core.initialize({ name, directory, spec, quickJS, development })

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: false,
	})

	let actionCount = 0
	let sessionCount = 0

	rl.on("line", (line) => {
		const { type, ...message } = JSON.parse(line)
		if (type === "action") {
			assert(actionType.is(message))
			core
				.apply(message)
				.then(() => actionCount++)
				.catch((err) => console.error(chalk.red("[canvas-cli] Failed to apply action:"), err))
		} else if (type === "session") {
			assert(sessionType.is(message))
			core
				.session(message)
				.then(() => sessionCount++)
				.catch((err) => console.error(chalk.red("[canvas-cli] Failed to apply session:"), err))
		}
	})

	rl.on("close", async () => {
		await core.onIdle()
		console.log(`[canvas-cli] Imported ${actionCount} actions, ${sessionCount} sessions`)
	})
}
