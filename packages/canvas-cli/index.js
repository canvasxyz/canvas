#!/usr/bin/env node

import yargs from "yargs"
import { hideBin } from "yargs/helpers"

import { commands } from "./commands/index.js"

yargs(hideBin(process.argv))
	.command(commands)
	.demandCommand()
	.recommendCommands()
	.strict()
	.scriptName("canvas")
	.help()
	.parse()
