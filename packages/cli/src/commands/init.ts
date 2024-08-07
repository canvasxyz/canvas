import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"

import chalk from "chalk"
import type { Argv } from "yargs"

import { CONTRACT_FILENAME, MANIFEST_FILENAME } from "../utils.js"

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
			desc: "Application topic",
			type: "string",
		})

type Args = ReturnType<typeof builder> extends Argv<infer T> ? T : never

export async function handler(args: Args) {
	const location = path.resolve(args.path)
	const contractPath = path.resolve(location, CONTRACT_FILENAME)
	const manifestPath = path.resolve(location, MANIFEST_FILENAME)

	if (fs.existsSync(contractPath)) {
		console.log(chalk.gray(`Found existing contract at ${contractPath}`))
		return
	}

	const topic = args.topic ?? randomUUID()
	console.log(chalk.gray(`Creating example contract with topic ${chalk.white(topic)}`))

	if (!fs.existsSync(location)) {
		console.log(chalk.gray(`Creating ${location}/`))
		fs.mkdirSync(location, { recursive: true })
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

	console.log(chalk.gray(`Creating ${contractPath}`))
	fs.writeFileSync(contractPath, contract)

	console.log(chalk.gray(`Creating ${manifestPath}`))
	fs.writeFileSync(manifestPath, JSON.stringify({ version: 1, topic }))

	const relativeContractPath = chalk.bold(path.relative(".", contractPath))
	const relativeLocation = path.relative(".", location)
	const command = chalk.bold(`canvas run ${relativeLocation}`)
	console.log(`Done! Edit the contract at ${relativeContractPath} or run \`${command}\` to get started.`)
}
