import fs from "node:fs"
import path from "node:path"

import readline from "readline"
import hypercore from "hypercore"
import HyperBee from "hyperbee"

import { NativeCore, actionType, sessionType } from "@canvas-js/core"
import { createPrefixStream } from "../utils/prefixStream.js"

import { defaultDataDirectory, downloadSpec } from "./utils.js"

export const command = "import <spec>"
export const desc = "Import actions and sessions"
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
	const [appPath, spec] = await downloadSpec(args.spec, args.datadir, args.reset)

	const core = await NativeCore.initialize({ spec, dataDirectory: appPath })

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: false,
	})

	const objs = []
	rl.on("line", (line) => {
		const obj = JSON.parse(line)
		objs.push(obj)
	})

	rl.on("close", async () => {
		let a = 0
		let s = 0

		for (const obj of objs) {
			if (sessionType.is(obj)) {
				await core.session(obj).catch(console.log)
				s++
			}
		}

		for (const obj of objs) {
			if (actionType.is(obj)) {
				await core.apply(obj, { replaying: true }).catch(console.log)
				a++
			}
		}

		console.log(`Imported ${a} actions, ${s} sessions`)
	})
}
