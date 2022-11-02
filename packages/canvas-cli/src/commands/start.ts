import fs from "node:fs"
import path from "node:path"

import yargs from "yargs"
import chalk from "chalk"
import { Agent, fetch } from "undici"

import { CANVAS_HOME, SOCKET_PATH, cidPattern } from "../utils.js"
import { StatusCodes } from "http-status-codes"

export const command = "start <spec>"
export const desc = "Start an app on the daemon"

export const builder = (yargs: yargs.Argv) =>
	yargs.positional("spec", {
		describe: "spec CID",
		type: "string",
		demandOption: true,
	})

type Args = ReturnType<typeof builder> extends yargs.Argv<infer T> ? T : never

export async function handler(args: Args) {
	if (!cidPattern.test(args.spec)) {
		console.log(chalk.red(`[canvas-cli] spec must be a CID`))
		process.exit(1)
	}

	const res = await fetch(`http://localhost/app/${args.spec}/start`, {
		method: "POST",
		dispatcher: new Agent({ connect: { socketPath: SOCKET_PATH } }),
	})

	if (res.status === StatusCodes.OK) {
		console.log(chalk.green(`[canvas-cli] ipfs://${args.spec} started successfully.`))
	} else if (res.status === StatusCodes.CONFLICT) {
		console.log(chalk.red(`[canvas-cli] ipfs://${args.spec} is already running.`))
	} else if (res.status === StatusCodes.NOT_FOUND) {
		console.log(chalk.red(`[canvas-cli] ipfs://${args.spec} is not installed.`))
	} else {
		const err = await res.text()
		console.log(chalk.red(`[canvas-cli] Failed to start spec:`), err)
	}
}
