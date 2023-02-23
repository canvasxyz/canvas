import assert from "node:assert"
import path from "node:path"

import type { Argv } from "yargs"
import chalk from "chalk"

import * as constants from "@canvas-js/core/constants"
import { stringify } from "@canvas-js/core/utils"
import { MessageStore } from "@canvas-js/core/components/messageStore"

import { parseSpecArgument } from "../utils.js"

export const command = "export <spec>"
export const desc = "Export actions and sessions as JSON to stdout"
export const builder = (yargs: Argv) =>
	yargs.positional("spec", {
		describe: "CID of spec",
		type: "string",
		demandOption: true,
	})

type Args = ReturnType<typeof builder> extends Argv<infer T> ? T : never

export async function handler(args: Args) {
	const { directory, uri } = parseSpecArgument(args.spec)
	assert(directory !== null, "Cannot export from local specs because they do not persist any data")
	const messageStore = await MessageStore.initialize(uri, directory)

	let i = 0
	for await (const [_, message] of messageStore.getMessageStream()) {
		console.log(stringify(message))
		i++
	}

	console.error(chalk.yellow(`Exported ${i} message${i === 1 ? "" : "s"}`))
	process.exit(0)
}
