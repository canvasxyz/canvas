import assert from "node:assert"
import readline from "node:readline"

import type { Argv } from "yargs"
import chalk from "chalk"
import * as json from "@ipld/dag-json"

import type { Action, Message, Session, Signature } from "@canvas-js/interfaces"
import { Canvas } from "@canvas-js/core"

import { getContractLocation } from "../utils.js"

export const command = "import <path>"
export const desc = "Import an action log from stdin"
export const builder = (yargs: Argv) =>
	yargs
		.positional("path", {
			describe: "Path to application directory or *.canvas.js contract",
			type: "string",
			demandOption: true,
		})
		.option("topic", {
			desc: "Application topic",
			type: "string",
			require: true,
		})
		.option("chain-rpc", {
			type: "array",
			desc: "Provide an RPC endpoint for reading on-chain data (format: chain, URL)",
		})
		.option("unchecked", {
			type: "boolean",
			desc: "Run the node in unchecked mode, without verifying block hashes",
		})

type Args = ReturnType<typeof builder> extends Argv<infer T> ? T : never

export async function handler(args: Args) {
	const { location, contract } = getContractLocation(args)
	assert(location !== null, "Cannot import to development apps since they do not persist any data")

	const app = await Canvas.initialize({ topic: args["topic"], path: location, contract, start: false })

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: false,
	})

	let messageCount = 0

	rl.on("line", async (line) => {
		const { id, signature, message } = json.parse<{
			id: string
			signature: Signature
			message: Message<Action | Session>
		}>(line)

		try {
			const result = await app.insert(signature, message)
			console.log(`[canvas] Applied message ${result.id}`, message.payload)
			if (result.id !== id) {
				console.log(chalk.yellow(`[canvas] Got unexpected message id (expected ${id}, got ${result.id})`))
			}

			messageCount++
		} catch (err) {
			if (err instanceof Error) {
				console.log(chalk.red(`[canvas] Failed to apply message (${err.message})`))
			} else {
				throw err
			}
		}
	})

	rl.on("close", async () => {
		console.log(`[canvas] Imported ${messageCount} messages`)
	})
}
