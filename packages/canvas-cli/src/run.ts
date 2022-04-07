import * as fs from "node:fs"
import * as path from "node:path"

import { App } from "canvas-core"

export interface RunCommandArgs {
	path: string
	port?: number
}

export default async function run(args: RunCommandArgs) {
	const multihash = fs.readFileSync(path.resolve(args.path, "spec.cid"), "utf-8")
	await App.initialize({ multihash, path: args.path, port: args.port })
}
