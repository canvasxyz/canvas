import fs from "node:fs"
import path from "node:path"
import os from "node:os"

import fetch from "node-fetch"
import chalk from "chalk"
import Database from "better-sqlite3"

import prompts from "prompts"

import { Store } from "@canvas-js/core"

export const SPEC_FILENAME = "spec.canvas.js"

export async function deleteDatabase(directory, { prompt } = {}) {
	const databasePath = path.resolve(directory, Store.DATABASE_FILENAME)
	if (fs.existsSync(databasePath)) {
		if (prompt) {
			const { confirm } = await prompts({
				type: "confirm",
				name: "confirm",
				message: `${chalk.yellow(`Do you want to ${chalk.bold("erase all data")} in ${directory}?`)}`,
			})

			if (!confirm) {
				console.log("[canvas-cli] Cancelled.")
				process.exit(1)
			}
		}

		console.log(`[canvas-cli] Deleting ${databasePath}`)
		fs.rmSync(databasePath)
	}
}

export async function deleteGeneratedModels(directory, { prompt } = {}) {
	const databasePath = path.resolve(directory, Store.DATABASE_FILENAME)
	if (fs.existsSync(databasePath)) {
		if (prompt) {
			const { confirm } = await prompts({
				type: "confirm",
				name: "confirm",
				message: `${chalk.yellow(`Do you want to ${chalk.bold("erase the model database")} at ${databasePath}?`)}`,
			})

			if (!confirm) {
				console.log("[canvas-cli] Cancelled.")
				process.exit(1)
			}
		}

		console.log(`[canvas-cli] Clearing generated models from ${databasePath}`)
		const db = new Database(databasePath)
		const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name").all()
		const query = tables
			.map((t) => t.name)
			.filter((t) => !t.startsWith("_") && !t.startsWith("sqlite_"))
			.map((t) => `DROP TABLE IF EXISTS ${t};\nDROP TABLE IF EXISTS _${t}_deleted;`)
			.join("\n")
		if (query) console.log(chalk.green(query))
		db.exec(query)
	}
}

export const cidPattern = /^Qm[a-zA-Z0-9]{44}$/

export async function locateSpec({ spec: name, datadir, ipfs, temp }) {
	if (cidPattern.test(name)) {
		const directory = temp ? null : path.resolve(datadir, name)
		const specPath = path.resolve(datadir, name, SPEC_FILENAME)
		if (fs.existsSync(specPath)) {
			const spec = fs.readFileSync(specPath, "utf-8")
			return { specPath, directory, name, spec, development: false }
		} else {
			const spec = await download(name, ipfs)
			if (!fs.existsSync(path.resolve(datadir, name))) {
				fs.mkdirSync(path.resolve(datadir, name))
			}
			fs.writeFileSync(specPath, spec)
			console.log(`[canvas-cli] Downloaded to ${specPath}`)
			return { specPath, directory, name, spec, development: false }
		}
	} else if (name.endsWith(".js")) {
		const specPath = path.resolve(name)
		const spec = fs.readFileSync(specPath, "utf-8")
		const directory = temp ? null : specPath.slice(0, specPath.lastIndexOf("."))
		return { specPath, directory, name: specPath, spec, development: true }
	} else {
		console.error(chalk.red("[canvas-cli] Spec argument must be a CIDv0 or a path to a local .js file"))
		process.exit(1)
	}
}

function download(cid, ipfsURL) {
	console.log(`[canvas-cli] Attempting to download ${cid} from local IPFS node...`)
	return fetch(`${ipfsURL}/api/v0/cat?arg=${cid}`, { method: "POST" })
		.then((res) => res.text())
		.catch((err) => {
			if (err.code === "ECONNREFUSED") {
				console.error(
					chalk.red(
						"[canvas-cli] Could not connect to local IPFS daemon. Try running `ipfs daemon` in another process."
					)
				)
				process.exit(1)
			} else {
				throw err
			}
		})
}

export const defaultDataDirectory = process.env.CANVAS_DATA_DIRECTORY ?? path.resolve(os.homedir(), ".canvas")

export function getDirectorySize(directory) {
	return fs.readdirSync(directory).reduce((totalSize, name) => {
		const file = path.resolve(directory, name)
		const stat = fs.statSync(file)
		if (stat.isDirectory()) {
			return totalSize + stat.size + getDirectorySize(file)
		} else {
			return totalSize + stat.size
		}
	}, 0)
}
