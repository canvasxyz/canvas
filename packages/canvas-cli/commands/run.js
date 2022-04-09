import fs from "node:fs"
import path from "node:path"

export const command = "run <path>"
export const desc = "Launch a Canvas app"
export const builder = (yargs) => {
	yargs
		.positional("path", {
			describe: "Path of the app data directory",
			type: "string",
		})
		.option("port", { type: "number", default: 8000, desc: "Port to bind the core API" })
}

export async function handler(args) {
	const multihash = fs.readFileSync(path.resolve(args.path, "spec.cid"), "utf-8")
	await App.initialize({ multihash, path: args.path, port: args.port })
}
