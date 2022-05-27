import fs from "node:fs"
import path from "node:path"
import chalk from "chalk"

import * as t from "io-ts"

import { BrowserCore, actionType, sessionType } from "@canvas-js/core"

import { defaultDataDirectory, isMultihash } from "./utils.js"

export const command = "info <spec>"
export const desc = "Show the models, views, and actions for a spec"

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
			default: defaultDataDirectory,
		})
}

export async function handler(args) {
	let spec
	if (isMultihash(args.spec)) {
		if (fs.existsSync(path.resolve(args.datadir, args.spec))) {
			// read spec from datadir
			spec = fs.readFileSync(path.resolve(args.datadir, args.spec, "spec.mjs"), "utf-8")
		} else {
			// fetch spec from multihash
			console.log("Downloading", args.spec, "from IPFS...")
			spec = await download(args.spec)
		}
	} else {
		// read spec from file
		spec = fs.readFileSync(args.spec, "utf-8")
	}

	const core = await BrowserCore.initialize({ spec })

	console.log(`Showing info for ${core.multihash}:\n`)
	console.log("models:", core.models)

	console.log(
		"routes:",
		Object.keys(core.routes).map((name) => `GET ${name}`)
	)

	console.log(
		"actions:",
		Object.entries(core.actionParameters).map(([name, params]) => `${name}(${params.join(", ")})`)
	)

	console.log(`\nFound ${core.feed.length} actions. Connect to peers to retrieve more.`)

	console.log(`
To initialize a session, POST a JSON object to /sessions
with these properties:`)
	console.log(printType(sessionType))

	console.log(`
To apply an action, POST a JSON object to /actions
with these properties:`)
	console.log(printType(actionType))

	console.log(`
Payloads should be signed by either the "from" address, or
the "session" public key using EIP-712.

If a session public key is used, the server will only
accept it if it has seen a recent session.

Timestamps should be provided as UTC unixtimes, and are
unchecked, except to ensure they reasonably correspond
to a time when the Canvas protocol exists.

Canvas currently supports these cryptography schemes:
- Ethereum (ECDSA)
`)
}

function printType(type, indent = "") {
	if (type instanceof t.InterfaceType) {
		const props = Object.entries(type.props).map(
			([name, prop]) => `${indent}  ${name}: ${printType(prop, indent + "  ")}\n`
		)
		return `{\n${props.join("") + indent}}`
	} else {
		return chalk.green(type.name)
	}
}
