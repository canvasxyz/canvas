import fs from "node:fs"
import path from "node:path"
import chalk from "chalk"

import * as t from "io-ts"
import { getQuickJS } from "quickjs-emscripten"

import { Core, actionType, sessionType } from "@canvas-js/core"

import { defaultDataDirectory, locateSpec } from "../utils.js"

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
			default: defaultDataDirectory,
		})
		.option("ipfs", {
			type: "string",
			desc: "IPFS HTTP API URL",
			default: "http://localhost:5001",
		})
}

export async function handler(args) {
	const { directory, name, spec, development } = await locateSpec({ ...args, temp: true })

	const quickJS = await getQuickJS()

	const core = await Core.initialize({ name, spec, directory, quickJS, development })

	console.log(`name: ${core.name}:\n`)

	console.log(`models: ${JSON.stringify(core.models, null, "  ")}\n`)

	console.log("routes:")
	console.log(
		Object.keys(core.routeParameters)
			.map((route) => `  GET ${route}\n`)
			.join("")
	)

	console.log("actions:")
	console.log(
		Object.entries(core.actionParameters)
			.map(([name, params]) => `  ${name}(${params.join(", ")})\n`)
			.join("")
	)

	console.log("To initialize a session, POST to /sessions (JSON):")
	console.log(printType(sessionType))
	console.log("")
	console.log("To apply an action, POST to /actions (JSON):")
	console.log(printType(actionType))
	console.log(`
Payloads should be signed by either the "from" or "session"
address using EIP-712 signTypedData_v4. Timestamps
should be provided as UTC unixtimes with msec resolution.`)
	console.log(`
Found ${core.feed.length} actions. Connect to peers to retrieve more.`)

	await core.close()
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
