import chalk from "chalk"
import prompts from "prompts"

import { Canvas } from "@canvas-js/core"

const indirectEval = eval

export const startActionPrompt = (app: Canvas) => {
	const { models, actions } = app.getApplicationData()

	console.log(chalk.gray("You can run actions from the command line here:"))
	console.log(chalk.gray(`> ${actions[0]}({ foo: 1, bar: "2" })`))

	const repl = async () => {
		const { actionString } = await prompts({
			type: "text",
			name: "actionString",
			message: "Enter an action:",
			validate: (actionString) => {
				if (actionString === "exit" || actionString === "quit" || actionString === "q") {
					process.exit(0)
					return "Exiting"
				}
				const [callString] = actionString.split("(")
				if (actions.indexOf(callString) === -1) {
					return `Invalid action, expected one of: ${actions.join(", ")}`
				}
				if (!actionString.endsWith(")")) {
					return `Invalid action, expected format: ${actions[0]}({})`
				}
				return true
			},
		})

		if (actionString === undefined) {
			process.exit(0)
		}
		const [call] = actionString.split("(")
		const argString = actionString.replace(call + "(", "").replace(/\)$/, "")

		let args
		try {
			args = eval?.(`"use strict";(${argString})`) // loose json parse
		} catch (err) {
			console.log("Arguments must be valid JS")
		}

		if (typeof args === "object") {
			console.log(`Executing ${call}(${JSON.stringify(args)})`)
			try {
				const result = await app.actions[call].call(this, args)
				console.log("[canvas] Applied message", result)
			} catch (err) {
				console.log("Action rejected by contract")
				console.log(err)
			}
		} else {
			console.log("Arguments must be an object")
		}

		// continue repl
		repl()
	}

	// start repl
	repl()
}
