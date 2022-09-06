import yargs from "yargs"
import chalk from "chalk"

import { getQuickJS } from "quickjs-emscripten"

import { Core } from "@canvas-js/core"
import { defaultDatabaseURI, getModelStore, locateSpec } from "../utils.js"

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

type Args = ReturnType<typeof builder> extends yargs.Argv<infer T> ? T : never

export async function handler(args: Args) {
	const { directory, name, spec } = await locateSpec(args.spec)
	const databaseURI = args.database || defaultDatabaseURI(directory)
	const store = getModelStore(databaseURI, { verbose: false })

	const quickJS = await getQuickJS()
	const core = await Core.initialize({ directory: null, store, name, spec, quickJS, unchecked: true })

	let i = 0
	for await (const [_, session] of core.messageStore.getSessionStream()) {
		console.log(JSON.stringify(session))
		i++
	}

	for await (const [_, action] of core.messageStore.getActionStream()) {
		console.log(JSON.stringify(action))
		i++
	}

	console.error(chalk.yellow(`Exported ${i} message${i === 1 ? "" : "s"}`))
	await core.close()
	process.exit(0)
}
