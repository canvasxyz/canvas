import path from "node:path"
import chalk from "chalk"
import { NativeCore, actionType, actionPayloadType, sessionPayloadType } from "canvas-core"
import { getSpec } from "./utils.js"

export const command = "info <spec> [--datadir=apps]"
export const desc = "Show the models, views, and actions for a spec."

export const builder = (yargs) => {
	yargs
		.positional("spec", {
			describe: "Path to spec file, or IPFS hash of spec",
			type: "string",
			demandOption: true,
		})
		.option("datadir", {
			describe: "Path of the app data directory",
			type: "string",
			default: "./apps",
		})
}

export async function handler(args) {
	const { multihash, spec } = await getSpec(args.spec)
	const dataDirectory = path.resolve(args.datadir, multihash)

	const core = await NativeCore.initialize({
		spec,
		dataDirectory,
		port: args.port,
	})

	console.log(`Showing info for ${multihash}:`)

	console.log("")
	console.log("models:", core.models)
	console.log(
		"routes:",
		Object.keys(core.routes).map((name) => `GET ${name}`)
	)
	console.log(
		"actions:",
		Object.entries(core.actionParameters).map(([name, params]) => `${name}: ({ ${params.join(", ")} })`)
	)

	console.log("")
	console.log(`Found ${core.feed.length} actions. Connect to peers to retrieve more.`)

	console.log(`
To apply an action or initialize a session, POST
a JSON object to the server following this schema:`)
	console.log("{")
	Object.entries(actionType.props).map(([field, { name }]) => {
		console.log(`    ${field}: ${chalk.green(name)},`)
	})
	console.log("}")

	console.log(`
To initialize a session, provide this as the payload,
in stringified form:`)
	console.log("{")
	Object.entries(sessionPayloadType.props).map(([field, { name }]) => {
		console.log(`    ${field}: ${chalk.green(name)},`)
	})
	console.log("}")

	console.log(`
To apply an action, provide this as the payload,
in stringified form:`)
	console.log("{")
	Object.entries(actionPayloadType.props).map(([field, { name }]) => {
		console.log(`    ${field}: ${chalk.green(name)},`)
	})
	console.log("}")

	console.log(`
Payloads should be signed by either the "from" address, or
the "session" public key.

If a session public key is used, the server will only
accept it if it has seen a recent session.

Timestamps should be provided as UTC unixtimes, and are
unchecked, except to ensure they reasonably correspond
to a time when the Canvas protocol exists.

Canvas currently supports these cryptography schemes:
- Ethereum (ECDSA)
`)
}
