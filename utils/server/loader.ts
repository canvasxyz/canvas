import fs from "node:fs"

import { prisma } from "./services"
import { App, AppStatus } from "core"

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
	public readonly status = new Map<string, AppStatus>()

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
			await this.start(multihash).catch((err) => {
				console.error(err)
			})
		}
	}

	public async start(multihash: string): Promise<void> {
		const status = this.status.get(multihash)
		if (status !== undefined) {
			if (status.status === "starting") {
				throw new Error("app already starting")
			} else if (status.status === "running") {
				throw new Error("app already running")
			}
		}

		const version = await prisma.appVersion.findUnique({ where: { multihash }, select: { spec: true } })
		if (version === null) {
			throw new Error("no app version with that multihash exists")
		}

		const port = 8000 + this.status.size
		this.status.set(multihash, { status: "starting" })
		await App.initialize(multihash, version.spec, port)
			.then((app) => {
				const { models, actionParameters } = app
				this.status.set(multihash, { status: "running", models, actionParameters })
				this.apps.set(multihash, app)
			})
			.catch((err: Error) => {
				this.status.set(multihash, { status: "failed", error: err.message })
				// TODO: think about whether this should actually re-throw the error or not
				throw err
			})
	}

	public async stop(multihash: string): Promise<void> {
		const app = this.apps.get(multihash)
		if (app === undefined) {
			throw new Error("app not running")
		}

		await app.stop()
		this.apps.delete(multihash)
		this.status.delete(multihash)
	}
}
