import fs from "node:fs"
import path from "node:path"

import yargs from "yargs"
import chalk from "chalk"

import { SqliteStore } from "@canvas-js/core"
import { CANVAS_HOME, cidPattern, SPEC_FILENAME } from "../utils.js"

export const command = "list"
export const desc = "List all specs in the data directory"

export const builder = (yargs: yargs.Argv) => yargs

export async function handler({}) {
	console.log(`Showing local specs in ${path.resolve(CANVAS_HOME)}\n`)
	for (const cid of fs.readdirSync(CANVAS_HOME)) {
		if (!cidPattern.test(cid)) {
			console.warn(chalk.yellow(`[canvas-cli] Unknown spec or invalid CIDv0, skipping: ${cid}`))
			continue
		}

		const specPath = path.resolve(CANVAS_HOME, cid, SPEC_FILENAME)
		const specStat = fs.existsSync(specPath) ? fs.statSync(specPath) : null

		const databasePath = path.resolve(CANVAS_HOME, cid, SqliteStore.DATABASE_FILENAME)
		const databaseStat = fs.existsSync(databasePath) ? fs.statSync(databasePath) : null

		console.log(cid)
		console.log(`Spec:     ${specStat?.size ?? "--"} bytes`)
		console.log(`Data:     ${databaseStat?.size ?? "--"} bytes`)
		console.log("")
	}
}
