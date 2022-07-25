import fs from "node:fs"
import path from "node:path"

import chalk from "chalk"

import { Core } from "@canvas-js/core"
import { defaultDataDirectory, locateSpec } from "../utils.js"

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
			default: defaultDataDirectory,
		})
		.option("ipfs", {
			type: "string",
			desc: "IPFS HTTP API URL",
			default: "http://localhost:5001",
		})
}

export async function handler(args) {
	const { directory } = await locateSpec({ ...args, temp: false })

	// TODO: select message log from database
	for await (const entry of []) {
		if (entry.type === "put") {
			const value = JSON.parse(entry.value)
			if (entry.key.startsWith(Core.actionKeyPrefix)) {
				console.log(JSON.stringify({ type: "action", ...value }))
			} else if (entry.key.startsWith(Core.sessionKeyPrefix)) {
				console.log(JSON.stringify({ type: "session", ...value }))
			} else {
				console.error(chalk.red("[canvas-cli] Skipping invalid entry"))
			}
		}
	}

	// TODO: close the db connection
}
