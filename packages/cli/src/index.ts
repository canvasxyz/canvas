#!/usr/bin/env node

import yargs from "yargs"
import { hideBin } from "yargs/helpers"

import { commands } from "./commands/index.js"

export { AppInstance } from "./AppInstance.js"

commands
	.reduce((argv, command) => argv.command(command), yargs(hideBin(process.argv)))
	.demandCommand()
	.recommendCommands()
	.strict()
	.scriptName("canvas")
	.help()
	.parse()
