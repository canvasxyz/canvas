import type { Argv } from "yargs"

import * as json from "@ipld/dag-json"

import { Canvas } from "@canvas-js/core"

import { getContractLocation } from "../utils.js"

export const command = "export <path>"
export const desc = "Export the messages in a topic as dag-json to stdout"
export const builder = (yargs: Argv) =>
	yargs.positional("path", {
		describe: "Path to application directory",
		type: "string",
		demandOption: true,
	})

type Args = ReturnType<typeof builder> extends Argv<infer T> ? T : never

export async function handler(args: Args) {
	const { contract, location, uri } = getContractLocation(args)
	if (location === null) {
		throw new Error("Expected path to application directory, found path to contract file")
	}

	const app = await Canvas.initialize({ contract, location, uri, offline: true })
	for await (const [id, signature, message] of app.getMessageStream()) {
		process.stdout.write(json.format([id, signature, message]))
		process.stdout.write("\n")
	}
}
