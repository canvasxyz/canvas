import fs from "node:fs"
import path from "node:path"

import chalk from "chalk"
import type { Argv } from "yargs"

import { CONTRACT_FILENAME } from "../utils.js"

export const command = "init <path>"
export const desc = "Initialize a new application"

export const builder = (yargs: Argv) =>
	yargs.positional("path", {
		describe: "Path to application directory",
		type: "string",
		default: ".",
	})

type Args = ReturnType<typeof builder> extends Argv<infer T> ? T : never

export async function handler(args: Args) {
	const location = path.resolve(args.path)
	if (!fs.existsSync(location)) {
		fs.mkdirSync(location, { recursive: true })
		fs.mkdirSync(path.resolve(location, "messages"))
		console.log(chalk.gray(`Created application directory at ${location}`))
	}

	const contractPath = path.resolve(location, CONTRACT_FILENAME)
	if (fs.existsSync(contractPath)) {
		console.log(chalk.gray(`Found existing contract at ${contractPath}`))
		return
	}

	const contract = `
// A Canvas backend for a simple chat application.

export const models = {
	messages: {
		content: "string",
		address: "string",
		timestamp: "integer",
		$indexes: ["timestamp"],
	},
};

export const actions = {
	async createMessage(db, { content }, { id, chain, address, timestamp }) {
		const messageId = [chain, address, id].join(":")
		await db.messages.set(messageId, { content, address, timestamp });
	},
	async deleteMessage(db, { messageId }, { chain, address }) {
		assert(messageId.startsWith([chain, address].join(":")))
		await db.messages.delete(messageId);
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
