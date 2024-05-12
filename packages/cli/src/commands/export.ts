import type { Argv } from "yargs"

import * as json from "@ipld/dag-json"

import { Canvas } from "@canvas-js/core"

import { getContractLocation } from "../utils.js"

export const command = "export <path>"
export const desc = "Export the action log as dag-json to stdout"
export const builder = (yargs: Argv) =>
	yargs.positional("path", {
		describe: "Path to application directory",
		type: "string",
		demandOption: true,
	})

type Args = ReturnType<typeof builder> extends Argv<infer T> ? T : never

export async function handler(args: Args) {
	const { location, contract } = getContractLocation(args)
	if (location === null) {
		throw new Error("Expected path to application directory, found path to contract file")
	}

	const app = await Canvas.initialize({ path: location, contract, start: false })
	for await (const [id, signature, message] of app.getMessages()) {
		process.stdout.write(json.format({ id, signature, message }))
		process.stdout.write("\n")
	}
}
