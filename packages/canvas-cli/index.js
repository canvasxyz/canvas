#!/usr/bin/env node
import fs from "node:fs"
import updateNotifier from "update-notifier"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

import { commands } from "./commands/index.js"

// const notifier = updateNotifier({
// 	pkg: JSON.parse(fs.readFileSync("./package.json", "utf-8")),
// 	updateCheckInterval: 1, // always check
// })
// notifier.notify()

yargs(hideBin(process.argv))
	.command(commands)
	.demandCommand()
	.recommendCommands()
	.strict()
	.scriptName("canvas")
	.help()
	.showHelpOnFail(false)
	.parse()
