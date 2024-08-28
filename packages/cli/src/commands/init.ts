import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"

import chalk from "chalk"
import type { Argv } from "yargs"

import { CONTRACT_FILENAME, MANIFEST_FILENAME } from "../utils.js"

export const command = "init <path>"
export const desc = "Initialize a new application. Try `canvas init .` to get started."

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
		did: "string",
		content: "string",
		timestamp: "integer",
		$indexes: ["timestamp"],
	},
};

export const actions = {
	async createMessage(db, { content }, { id, did, timestamp }) {
		await db.set("messages", { id, content, did, timestamp });
	},
	async deleteMessage(db, { messageId }, { did }) {
		const message = await db.get("messages", messageId)
		if (message !== null) {
			if (message.did !== did) {
				throw new Error("unauthorized")
			}

			await db.delete("messages", messageId);
		}
	},
};
`.trim()

	console.log(chalk.gray(`Creating ${contractPath}`))
	fs.writeFileSync(contractPath, contract)

	console.log(chalk.gray(`Creating ${manifestPath}`))
	fs.writeFileSync(manifestPath, JSON.stringify({ version: 1, topic }))

	const relativeContractPath = chalk.bold(path.relative(".", contractPath))
	const relativeLocation = path.relative(".", location) || "."
	const command = chalk.bold(`canvas run ${relativeLocation}`)
	console.log(`Done! Edit the contract at ${relativeContractPath} or run \`${command}\` to get started.`)
}
