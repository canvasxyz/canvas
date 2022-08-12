import fs from "node:fs"
import path from "node:path"
import chalk from "chalk"

import { getQuickJS } from "quickjs-emscripten"

import { Core } from "@canvas-js/core"
import { locateSpec, setupRpcs } from "../utils.js"

export const command = "export <spec>"
export const desc = "Export actions and sessions to stdout"
export const builder = (yargs) => {
	yargs
		.positional("spec", {
			describe: "Path to spec file, or IPFS hash of spec",
			type: "string",
			demandOption: true,
		})
		.option("datadir", {
			describe: "Path of the app data directory",
			type: "string",
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
		.option("compact", {
			describe: "Don't pretty-print exported JSON",
			type: "boolean",
			default: false,
		})
}

export async function handler(args) {
	const { directory, name, spec, development } = await locateSpec(args)

	const quickJS = await getQuickJS()
	const rpc = setupRpcs(args)
	const core = await Core.initialize({
		name,
		spec,
		directory,
		quickJS,
		verbose: args.verbose,
		rpc,
		unchecked: true,
		development,
	})

	let i = 0
	for await (const [key, value] of core.store.getHistoryStream()) {
		if (key.startsWith(Core.actionKeyPrefix)) {
			console.log(JSON.stringify({ type: "action", ...value }, null, args.compact ? null : 2))
		} else if (key.startsWith(Core.sessionKeyPrefix)) {
			console.log(JSON.stringify({ type: "session", ...value }, null, args.compact ? null : 2))
		} else {
			console.error(chalk.red("[canvas-cli] Skipping invalid entry"))
		}
		i++
	}

	console.error(chalk.yellow(`Exported ${i} action${i === 1 ? "" : "s"}`))
	await core.close()
	process.exit(0)
}
