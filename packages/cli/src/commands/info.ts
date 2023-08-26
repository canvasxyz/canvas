import type { Argv } from "yargs"

import chalk from "chalk"

import { parseSpecArgument } from "../utils.js"
import { Canvas } from "@canvas-js/core"

export const command = "info <app>"
export const desc = "Show the models, views, and actions for a app"

export const builder = (yargs: Argv) =>
	yargs.positional("app", {
		describe: "app filename or CID",
		type: "string",
		demandOption: true,
	})

type Args = ReturnType<typeof builder> extends Argv<infer T> ? T : never

export async function handler(args: Args) {
	const { uri, spec } = parseSpecArgument(args.app)

	try {
		const canvas = await Canvas.initialize({ contract: spec, uri, offline: true })

		const actions = canvas.actions

		const models = canvas.db.models

		console.log(`name: ${uri}\n`)

		console.log(chalk.green("===== models ====="))
		console.log(`${JSON.stringify(models, null, "  ")}\n`)

		console.log(chalk.green("===== actions ====="))
		console.log(
			Object.keys(actions)
				.map((name) => `${name}({ ...args })\n`)
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
