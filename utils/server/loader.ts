import fs from "node:fs"

import { prisma } from "./services"
import { App } from "core/app"

const appDirectory = process.env.APP_DIRECTORY!

if (typeof appDirectory !== "string") {
	throw new Error("Missing APP_DIRECTORY env variable from .env file")
}

if (!fs.existsSync(appDirectory)) {
	fs.mkdirSync(appDirectory)
}

/**
 * A Loader holds and manages the worker threads running apps.
 * There's only one loader instance for the whole hub.
 */
export class Loader {
	public readonly apps = new Map<string, App>()
	public readonly loadingApps = new Set<string>()

	constructor() {
		console.log("initializing loader")
		this.initialize()
	}

	private async initialize() {
		const versions = await prisma.appVersion.findMany({
			select: { multihash: true },
			where: { deployed: true },
		})

		for (const { multihash } of versions) {
			console.log("starting app", multihash)
			await this.start(multihash)
		}
	}

	public async start(multihash: string): Promise<void> {
		if (this.apps.has(multihash)) {
			throw new Error("app already running")
		}

		const version = await prisma.appVersion.findUnique({ where: { multihash }, select: { spec: true } })
		if (version === null) {
			throw new Error("no app version with that multihash exists")
		}

		const port = 8000 + this.apps.size + this.loadingApps.size
		this.loadingApps.add(multihash)
		const app = await App.initialize(multihash, version.spec, port)
		this.loadingApps.delete(multihash)
		this.apps.set(multihash, app)
	}

	public async stop(multihash: string): Promise<void> {
		const app = this.apps.get(multihash)
		if (app === undefined) {
			throw new Error("app not running")
		}

		await app.stop()
		this.apps.delete(multihash)
	}
}

// const alphanumeric = /^[a-zA-Z0-9]+$/
// const routePattern = /^(\/:?[a-zA-Z0-9]+)+$/
