import fs from "node:fs"
import path from "node:path"

import yargs from "yargs"
import chalk from "chalk"
import Database from "better-sqlite3"

import { constants } from "@canvas-js/core"
import { CANVAS_HOME, cidPattern, SOCKET_FILENAME } from "../utils.js"

export const command = "list"
export const desc = "List all apps in the data directory"

export const builder = (yargs: yargs.Argv) => yargs

export async function handler({}) {
	console.log(`Showing local apps in ${CANVAS_HOME}\n`)
	for (const name of fs.readdirSync(CANVAS_HOME)) {
		if (name === constants.PEER_ID_FILENAME || name === SOCKET_FILENAME) {
			continue
		} else if (!cidPattern.test(name)) {
			console.warn(chalk.yellow(`[canvas-cli] Unknown app or invalid CIDv0, skipping: ${name}`))
			continue
		}

		console.log(name)

		const specPath = path.resolve(CANVAS_HOME, name, constants.SPEC_FILENAME)
		if (fs.existsSync(specPath)) {
			const specStat = fs.statSync(specPath)
			console.log(`App:      ${specStat.size} bytes`)
		}

		const messagesPath = path.resolve(CANVAS_HOME, name, constants.MESSAGE_DATABASE_FILENAME)
		if (fs.existsSync(messagesPath)) {
			const messagesStat = fs.statSync(messagesPath)
			const messagesDB = new Database(messagesPath)
			const { count: actionCount } = messagesDB.prepare("SELECT COUNT(*) AS count FROM actions").get()
			const { count: sessionCount } = messagesDB.prepare("SELECT COUNT(*) AS count FROM sessions").get()
			console.log(`Messages: ${messagesStat.size} bytes (${actionCount} actions, ${sessionCount} sessions)`)
		}

		const modelsPath = path.resolve(CANVAS_HOME, name, constants.MODEL_DATABASE_FILENAME)
		if (fs.existsSync(modelsPath)) {
			const modelsStat = fs.statSync(modelsPath)
			console.log(`Models:   ${modelsStat.size} bytes`)
		}

		console.log("")
	}
}
