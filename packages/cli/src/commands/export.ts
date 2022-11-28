import assert from "node:assert"
import path from "node:path"

import yargs from "yargs"
import chalk from "chalk"

import { constants, MessageStore } from "@canvas-js/core"

import { parseSpecArgument } from "../utils.js"

export const command = "export <spec>"
export const desc = "Export actions and sessions as JSON to stdout"
export const builder = (yargs: yargs.Argv) =>
	yargs.positional("spec", {
		describe: "CID of spec",
		type: "string",
		demandOption: true,
	})

type Args = ReturnType<typeof builder> extends yargs.Argv<infer T> ? T : never

export async function handler(args: Args) {
	const { directory, uri } = parseSpecArgument(args.spec)
	assert(directory !== null, "Cannot export from local specs because they do not persist any data")

	const messageStore = new MessageStore(uri, path.resolve(directory, constants.MESSAGE_DATABASE_FILENAME))

	let i = 0
	for await (const [_, session] of messageStore.getSessionStream()) {
		console.log(JSON.stringify(session))
		i++
	}

	for await (const [_, action] of messageStore.getActionStream()) {
		console.log(JSON.stringify(action))
		i++
	}

	console.error(chalk.yellow(`Exported ${i} message${i === 1 ? "" : "s"}`))
	process.exit(0)
}
