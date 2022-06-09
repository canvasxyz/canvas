#!/usr/bin/env node
import fs from "node:fs"
import updateNotifier from "update-notifier"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

import { commands } from "./commands/index.js"
import pkg from "./package.json" assert { type: "json" }

const notifier = updateNotifier({
  pkg,
  updateCheckInterval: 1 // always check
})
notifier.notify()

yargs(hideBin(process.argv))
	.command(commands)
	.demandCommand()
	.recommendCommands()
	.strict()
	.scriptName("canvas")
	.help()
  .showHelpOnFail(false)
	.parse()
