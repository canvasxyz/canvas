import yargs from "yargs"
import chalk from "chalk"

import { getQuickJS } from "quickjs-emscripten"

import { Core } from "@canvas-js/core"
import { defaultDatabaseURI, locateSpec } from "../utils.js"

export const command = "export <spec>"
export const desc = "Export actions and sessions as JSON to stdout"
export const builder = (yargs: yargs.Argv) =>
	yargs
		.positional("spec", {
			describe: "Path to spec file, or IPFS hash of spec",
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
		.option("compact", {
			describe: "Don't pretty-print exported JSON",
			type: "boolean",
			default: false,
		})

type Args = ReturnType<typeof builder> extends yargs.Argv<infer T> ? T : never

export async function handler(args: Args) {
	const { directory, name, spec } = await locateSpec(args.spec, args.ipfs)
	const databaseURI = args.database || defaultDatabaseURI(directory)

	const quickJS = await getQuickJS()
	const core = await Core.initialize({
		databaseURI,
		name,
		spec,
		quickJS,
		verbose: args.verbose,
		unchecked: true,
	})

	let i = 0
	for await (const [_, session] of core.store.getSessionStream()) {
		console.log(JSON.stringify(session, null, args.compact ? undefined : 2))
		i++
	}
	for await (const [_, action] of core.store.getActionStream()) {
		console.log(JSON.stringify(action, null, args.compact ? undefined : 2))
		i++
	}

	console.error(chalk.yellow(`Exported ${i} message${i === 1 ? "" : "s"}`))
	await core.close()
	process.exit(0)
}
