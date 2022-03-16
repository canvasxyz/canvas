import fs from "fs"

import { Spec } from "./spec"

/**
 * A Loader is the thing that holds and manages Spec instances.
 * There's one instance of Spec for every installed app, but only
 * one instance of Loader for the entire server.
 *
 * Right now, Loader just reads the data directory synchronously
 * and loads the specs it finds there.
 *
 * (We could consider using worker_threads here too)
 */
export class Loader {
	public readonly specs: Record<string, Spec> = {}
	public readonly initialized: Promise<void>

	constructor() {
		console.log("constructing loader")
		this.initialized = this.initialize()
	}

	private async initialize(): Promise<void> {
		console.log("initializing loader")
		for (const name of fs.readdirSync("db")) {
			console.log("loading spec", name)
			// TODO: validate hashes maybe
			const spec = await import("db/" + name + "/spec.js")
			this.specs[name] = await new Spec(name, "db/" + name, spec).initialize()
		}
	}
}

// /**
//  * This is a next.js hack to prevent new spec loaders from accumulating during hot reloading
//  */
// function getLoader(): Loader {
// 	if (process.env.NODE_ENV === "production") {
// 		return new Loader()
// 	} else if (global.loader instanceof Loader) {
// 		return global.loader
// 	} else {
// 		global.loader = new Loader()
// 		return global.loader
// 	}
// }

// export const loader = getLoader()
