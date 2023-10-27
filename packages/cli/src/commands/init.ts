import fs from "node:fs"
import path from "node:path"
import assert from "node:assert"
import { randomUUID } from "node:crypto"

import chalk from "chalk"
import type { Argv } from "yargs"

import { topicPattern } from "@canvas-js/gossiplog"
import { CONTRACT_FILENAME, CONFIG_FILENAME } from "../utils.js"

export const command = "init <path>"
export const desc = "Initialize a new application"

export const builder = (yargs: Argv) =>
	yargs
		.positional("path", {
			describe: "Path to application directory",
			type: "string",
			default: ".",
		})
		.option("topic", {
			type: "string",
			alias: "t",
			desc: "Unique topic identifer (defaults to a random string)",
			demandOption: false,
		})

type Args = ReturnType<typeof builder> extends Argv<infer T> ? T : never

export async function handler(args: Args) {
	const location = path.resolve(args.path)
	if (!fs.existsSync(location)) {
		fs.mkdirSync(location, { recursive: true })
		console.log(chalk.gray(`Created application directory at ${location}`))
	}

	const configPath = path.resolve(location, CONFIG_FILENAME)
	const contractPath = path.resolve(location, CONTRACT_FILENAME)

	const topic = args.topic ?? randomUUID()
	assert(topicPattern.test(topic), "expected topic to match [a-zA-Z0-9\\.\\-]")

	if (fs.existsSync(configPath)) {
		console.log(chalk.gray(`Found existing config at ${configPath}`))
	} else {
		fs.writeFileSync(configPath, JSON.stringify({ topic }, null, "  "))
		console.log(chalk.gray(`Created config for topic ${topic} at ${contractPath}`))
	}

	if (fs.existsSync(contractPath)) {
		console.log(chalk.gray(`Found existing contract at ${contractPath}`))
		return
	}

	const contract = `
// A Canvas backend for a simple chat application.

export const models = {
	messages: {
		id: "primary",
		user: "string",
		content: "string",
		timestamp: "integer",
		$indexes: ["timestamp"],
	},
};

export const actions = {
	async createMessage(db, { content }, { id, chain, address, timestamp }) {
		const user = [chain, address].join(":")
		await db.messages.set({ id, content, user, timestamp });
	},
	async deleteMessage(db, { messageId }, { chain, address }) {
		const message = await db.messages.get(messageId)
		if (message !== null) {
			const user = [chain, address].join(":")
			if (message.user !== user) {
				throw new Error("unauthorized")
			}
			
			await db.messages.delete(messageId);
		}
	},
};
`.trim()

	fs.writeFileSync(contractPath, contract)
	console.log(chalk.gray(`Created example contract at ${contractPath}`))

	const relativeContractPath = chalk.bold(path.relative(".", contractPath))
	const relativeLocation = path.relative(".", location)
	const command = chalk.bold(`canvas run ${relativeLocation}`)
	console.log(`Done! Edit the contract at ${relativeContractPath} or run \`${command}\` to get started.`)
}
