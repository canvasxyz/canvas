import assert from "node:assert"
import readline from "node:readline"
import fs from "node:fs"
import path from "node:path"

import yargs from "yargs"

import chalk from "chalk"

import { Core, actionType, sessionType, constants } from "@canvas-js/core"

import { getProviders, parseSpecArgument } from "../utils.js"

export const command = "import <app>"
export const desc = "Import actions and sessions from stdin"
export const builder = (yargs: yargs.Argv) =>
	yargs
		.positional("app", {
			describe: "CID of app",
			type: "string",
			demandOption: true,
		})

		.option("chain-rpc", {
			type: "array",
			desc: "Provide an RPC endpoint for reading on-chain data",
		})

type Args = ReturnType<typeof builder> extends yargs.Argv<infer T> ? T : never

export async function handler(args: Args) {
	const { uri, directory } = parseSpecArgument(args.app)
	assert(directory !== null, "Cannot import to development apps since they do not persist any data")

	const spec = fs.readFileSync(path.resolve(directory, constants.SPEC_FILENAME), "utf-8")

	const providers = getProviders(args["chain-rpc"])

	const core = await Core.initialize({ uri, directory, spec, providers, libp2p: null })

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
				.applyAction(message)
				.then(() => actionCount++)
				.catch((err) => console.error(chalk.red("[canvas-cli] Failed to apply action:"), err))
		} else if (type === "session") {
			assert(sessionType.is(message))
			core
				.applySession(message)
				.then(() => sessionCount++)
				.catch((err) => console.error(chalk.red("[canvas-cli] Failed to apply session:"), err))
		} else {
			console.error(chalk.red("[canvas-cli] Invalid message"), line)
		}
	})

	rl.on("close", async () => {
		console.log(`[canvas-cli] Imported ${actionCount} actions, ${sessionCount} sessions`)
	})
}
