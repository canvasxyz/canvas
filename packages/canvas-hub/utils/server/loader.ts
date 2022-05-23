import fs from "node:fs"
import path from "node:path"

import { NativeCore } from "@canvas-js/core"

import { prisma } from "./services"
import { AppStatus } from "./status"

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
	public readonly apps = new Map<string, NativeCore>()
	public readonly status = new Map<string, AppStatus>()

	constructor() {
		console.log("initializing loader")
		this.initialize()
	}

	private async initialize() {
		const versions = await prisma.appVersion.findMany({
			select: { multihash: true, spec: true },
			where: { deployed: true },
		})

		for (const { multihash, spec } of versions) {
			console.log("starting app", multihash)
			await this.start(multihash, spec).catch((err) => {
				console.error(err)
			})
		}
	}

	public async start(multihash: string, spec: string): Promise<void> {
		const status = this.status.get(multihash)
		if (status !== undefined) {
			if (status.status === "starting") {
				throw new Error("app already starting")
			} else if (status.status === "running") {
				throw new Error("app already running")
			}
		}

		this.status.set(multihash, { status: "starting" })
		const dataDirectory = path.resolve(appDirectory, multihash)
		await NativeCore.initialize({ spec, dataDirectory })
			.then((core) => {
				if (core.multihash !== multihash) {
					this.status.delete(multihash)
					throw new Error("Could not start app: declared multihash did not match the given spec")
				}

				this.apps.set(multihash, core)
			})
			.catch((err) => {
				this.status.delete(multihash)
				throw err
			})
	}

	public async stop(multihash: string): Promise<void> {
		const app = this.apps.get(multihash)
		if (app === undefined) {
			throw new Error("app not running")
		}

		await app.close()
		this.apps.delete(multihash)
		this.status.delete(multihash)
	}
}
