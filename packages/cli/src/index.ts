#!/usr/bin/env node

import yargs from "yargs"
import { hideBin } from "yargs/helpers"

import { commands } from "./commands/index.js"

commands
	.reduce((argv, command) => argv.command(command), yargs(hideBin(process.argv)))
	.demandCommand()
	.recommendCommands()
	.strict()
	.scriptName("canvas")
	.help()
	.parse()
