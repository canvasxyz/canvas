import fs from "node:fs"
import path from "node:path"
import chalk from "chalk"

import * as t from "io-ts"

import { NativeCore, actionType, sessionType } from "@canvas-js/core"

import { defaultDataDirectory, isMultihash, downloadSpec } from "./utils.js"

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
}

export async function handler(args) {
	const [appPath, spec] = await downloadSpec(args.spec, args.datadir, args.reset)

	const core = await NativeCore.initialize({ spec, dataDirectory: appPath })

	console.log(`Showing info for ${core.multihash}:\n`)
	console.log("models:", core.models)

	console.log(
		"routes:",
		Object.keys(core.routes).map((name) => `GET ${name}`)
	)

	console.log(
		"actions:",
		Object.entries(core.actionParameters).map(([name, params]) => `${name}(${params.join(", ")})`)
	)

	console.log(`
To initialize a session, POST to /sessions (JSON):`)
	console.log(printType(sessionType))

	console.log(`
To apply an action, POST to /actions (JSON):`)
	console.log(printType(actionType))

	console.log(`
Payloads should be signed by either the "from" or "session"
address using EIP-712 signTypedData_v4. Timestamps
should be provided as UTC unixtimes with msec resolution.
`)

	console.log(`Found ${core.feed.length} actions. Connect to peers to retrieve more.`)
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
