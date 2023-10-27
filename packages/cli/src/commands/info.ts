import type { Argv } from "yargs"

import chalk from "chalk"

import { Canvas } from "@canvas-js/core"
import { getContractLocation } from "../utils.js"

export const command = "info <path>"
export const desc = "Show the model schema and action names in a contract"

export const builder = (yargs: Argv) =>
	yargs.positional("path", {
		describe: "Path to application directory or *.canvas.js contract",
		type: "string",
		demandOption: true,
	})

type Args = ReturnType<typeof builder> extends Argv<infer T> ? T : never

export async function handler(args: Args) {
	const { contract, location } = getContractLocation(args)
	try {
		const app = await Canvas.initialize({ path: location, contract, offline: true })
		const { models } = app.getApplicationData()
		console.log(`topic: ${app.topic}\n`)
		console.log(chalk.green("===== models ====="))
		console.log(`${JSON.stringify(Object.values(models), null, "  ")}\n`)
		console.log(chalk.green("===== actions ====="))
		console.log(
			Object.keys(app.actions)
				.map((name) => `- ${name}({ ...args })\n`)
				.join("")
		)

		console.log("")
	} catch (err) {
		if (err instanceof Error) {
			console.log(chalk.red(err.message))
		} else {
			throw err
		}
	}

	process.exit(0)
}
