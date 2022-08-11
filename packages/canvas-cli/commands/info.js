import fs from "node:fs"
import path from "node:path"
import chalk from "chalk"

import * as t from "io-ts"
import { getQuickJS } from "quickjs-emscripten"

import { Core, actionType, sessionType } from "@canvas-js/core"

import { locateSpec } from "../utils.js"

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
}

export async function handler(args) {
	const { directory, name, spec, development } = await locateSpec({ ...args, temp: true })

	const quickJS = await getQuickJS()

	const core = await Core.initialize({ name, spec, directory, quickJS, development })

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
