import fs from "node:fs"
import path from "node:path"
import chalk from "chalk"

import * as t from "io-ts"
import { getQuickJS } from "quickjs-emscripten"

import { Core, actionType, sessionType } from "@canvas-js/core"

import { locateSpec, setupRpcs } from "../utils.js"

export const command = "info <spec>"
export const desc = "Show the models, views, and actions for a spec"

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
		.option("chain-rpc", {
			type: "array",
			desc: "Provide an RPC endpoint for reading on-chain data",
		})
}

export async function handler(args) {
	const { directory, name, spec, development } = await locateSpec({ ...args, temp: true })

	const quickJS = await getQuickJS()
	const rpc = setupRpcs(args)
	const core = await Core.initialize({ name, spec, directory, quickJS, verbose: args.verbose, rpc, development })

	console.log(`name: ${core.name}:\n`)

	console.log(chalk.green("===== models ====="))
	console.log(`${JSON.stringify(core.models, null, "  ")}\n`)

	console.log(chalk.green("===== routes ====="))
	Object.keys(core.routeParameters).forEach((route) => console.log(`GET ${route}`))
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

	console.log(chalk.green("===== contracts ====="))
	Object.entries(core.contractParameters).forEach(([name, { metadata }]) => {
		console.log(`${name}: ${metadata.chain} chainId:${metadata.chainId} ${metadata.address}`)
		metadata.abi.forEach((line) => console.log(`- ${line}`))
	})
	console.log("")

	await core.close()
	process.exit(0)
}

function printType(type, indent = "") {
	if (type instanceof t.InterfaceType) {
		const props = Object.entries(type.props).map(
			([name, prop]) => `${indent}  ${name}: ${printType(prop, indent + "  ")}\n`
		)
		return `{\n${props.join("") + indent}}`
	} else {
		return chalk.green(type.name)
	}
}
