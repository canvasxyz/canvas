import yargs from "yargs"
import { hideBin } from "yargs/helpers"

import run, { RunCommandArgs } from "./run.js"
import init, { InitCommandArgs } from "./init.js"

const args = yargs(hideBin(process.argv))
	.command<RunCommandArgs>(
		"run <path>",
		"Launch a Canvas app",
		(yargs) => {
			yargs
				.positional("path", {
					describe: "Path of the app data directory",
					type: "string",
				})
				.option("port", { type: "number", default: 8000, desc: "Port to bind the core API" })
		},
		(args) => run(args)
	)
	.command<InitCommandArgs>(
		"init <path>",
		"Initialize a Canvas app",
		(yargs) => {
			yargs
				.positional("path", {
					describe: "Path of the app data directory",
					type: "string",
				})
				.option("cid", { type: "string", demandOption: true, desc: "Hash of the spec to fetch from IPFS" })
		},
		(args) => init(args)
	)
	.scriptName("canvas")
	.demandCommand(1, "")
	.recommendCommands()
	.strict()
	.help()
	.parse()
