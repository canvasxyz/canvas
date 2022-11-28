import fs from "node:fs"

import yargs from "yargs"
import chalk from "chalk"

import { installSpec } from "../utils.js"

export const command = "install <spec>"
export const desc = "Install an app in the canvas home directory"

export const builder = (yargs: yargs.Argv) =>
	yargs.positional("spec", {
		describe: "Path to development spec file",
		type: "string",
		demandOption: true,
	})

type Args = ReturnType<typeof builder> extends yargs.Argv<infer T> ? T : never

export async function handler(args: Args) {
	const spec = fs.readFileSync(args.spec, "utf-8")
	const cid = await installSpec(spec)
	console.log(chalk.yellow(`[canvas-cli] Run the app with ${chalk.bold(`canvas run ${cid}`)}`))
}
