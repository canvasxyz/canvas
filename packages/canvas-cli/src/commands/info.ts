import yargs from "yargs"
import chalk from "chalk"
import * as t from "io-ts"
import { getQuickJS } from "quickjs-emscripten"

import { Core, actionType, sessionType, SqliteStore } from "@canvas-js/core"

import { defaultDatabaseURI, getModelStore, locateSpec } from "../utils.js"

export const command = "info <spec>"
export const desc = "Show the models, views, and actions for a spec"

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

type Args = ReturnType<typeof builder> extends yargs.Argv<infer T> ? T : never

export async function handler(args: Args) {
	const { name, spec, directory } = await locateSpec(args.spec, args.ipfs)
	const databaseURI = args.database || defaultDatabaseURI(directory)

	const quickJS = await getQuickJS()

	const store = getModelStore(databaseURI, {})
	const core = await Core.initialize({
		directory: null,
		store,
		name,
		spec,
		quickJS,
		verbose: args.verbose,
		unchecked: true,
	})

	console.log(`name: ${core.name}:\n`)

	console.log(chalk.green("===== models ====="))
	console.log(`${JSON.stringify(core.models, null, "  ")}\n`)

	// console.log(chalk.green("===== routes ====="))
	// Object.keys(core.routeParameters).forEach((route) => console.log(`GET ${route}`))
	console.log("POST /sessions")
	console.log(printType(sessionType))
	console.log("POST /actions")
	console.log(printType(actionType))
	console.log("")

	console.log(chalk.green("===== actions ====="))
	console.log(
		Object.entries(core.actionParameters)
			.map(([name, params]) => `${name}(${params.join(", ")})\n`)
			.join("")
	)

	// console.log(chalk.green("===== contracts ====="))
	// Object.entries(core.contractParameters).forEach(([name, { metadata }]) => {
	// 	console.log(`${name}: ${metadata.chain} chainId:${metadata.chainId} ${metadata.address}`)
	// 	metadata.abi.forEach((line) => console.log(`- ${line}`))
	// })
	// console.log("")

	await core.close()
	process.exit(0)
}

function printType<T>(type: t.Type<T>, indent = ""): string {
	if (type instanceof t.InterfaceType) {
		const props = Object.entries<t.Type<any>>(type.props).map(
			([name, prop]) => `${indent}  ${name}: ${printType(prop, indent + "  ")}\n`
		)

		return `{\n${props.join("") + indent}}`
	} else {
		return chalk.green(type.name)
	}
}
