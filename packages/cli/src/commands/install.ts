import fs from "node:fs"
import path from "node:path"

import yargs from "yargs"
import chalk from "chalk"
import Hash from "ipfs-only-hash"

import { constants } from "@canvas-js/core"

import { CANVAS_HOME } from "../utils.js"

export const command = "install <spec>"
export const desc = "Install an app in the canvas home directory"

export const builder = (yargs: yargs.Argv) =>
	yargs.positional("spec", {
		describe: "Path to development spec file",
		type: "string",
		demandOption: true,
	})

type Args = ReturnType<typeof builder> extends yargs.Argv<infer T> ? T : never

export async function installSpec(spec: string): Promise<string> {
	const cid = await Hash.of(spec)
	const directory = path.resolve(CANVAS_HOME, cid)
	if (!fs.existsSync(directory)) {
		console.log(`[canvas-cli] Creating app directory at ${directory}`)
		fs.mkdirSync(directory)
	}

	const specPath = path.resolve(directory, constants.SPEC_FILENAME)
	if (fs.existsSync(specPath)) {
		console.log(`[canvas-cli] ${specPath} already exists`)
	} else {
		console.log(`[canvas-cli] Creating ${specPath}`)
		fs.writeFileSync(specPath, spec, "utf-8")
	}
	return cid
}

export async function handler(args: Args) {
	const spec = fs.readFileSync(args.spec, "utf-8")

	const cid = await installSpec(spec)

	console.log(chalk.yellow(`[canvas-cli] Run the app with ${chalk.bold(`canvas run ${cid}`)}`))
}
