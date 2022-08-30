import assert from "node:assert"
import readline from "node:readline"

import yargs from "yargs"

import { getQuickJS } from "quickjs-emscripten"
import chalk from "chalk"

import { Core, actionType, sessionType } from "@canvas-js/core"

import { defaultDatabaseURI, locateSpec, setupRpcs } from "../utils.js"

export const command = "import <spec>"
export const desc = "Import actions and sessions from stdin"
export const builder = (yargs: yargs.Argv) =>
	yargs
		.positional("spec", {
			describe: "Path to spec file, or CID of spec",
			type: "string",
			demandOption: true,
		})
		.option("database", {
			type: "string",
			desc: "Override database URI",
		})
		.option("ipfs", {
			type: "string",
			desc: "IPFS HTTP API URL",
			default: "http://localhost:5001",
		})
		.option("verbose", {
			type: "boolean",
			desc: "Enable verbose logging",
			default: false,
		})
		.option("chain-rpc", {
			type: "array",
			desc: "Provide an RPC endpoint for reading on-chain data",
		})

type Args = ReturnType<typeof builder> extends yargs.Argv<infer T> ? T : never

export async function handler(args: Args) {
	const { name, directory, spec } = await locateSpec(args.spec, args.ipfs)
	const databaseURI = args.database || defaultDatabaseURI(directory)

	const quickJS = await getQuickJS()

	const rpc = setupRpcs(args["chain-rpc"])
	const core = await Core.initialize({ name, databaseURI, spec, quickJS, verbose: args.verbose, rpc })

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
		} else {
			console.error(chalk.red("[canvas-cli] Invalid message"), line)
		}
	})

	rl.on("close", async () => {
		await core.onIdle()
		console.log(`[canvas-cli] Imported ${actionCount} actions, ${sessionCount} sessions`)
	})
}
