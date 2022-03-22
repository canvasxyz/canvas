import path from "node:path"
import { Worker, MessageChannel, MessagePort } from "node:worker_threads"
import { prisma } from "utils/server/services"

/**
 * A Loader holds and manages the worker threads running apps.
 * There's only one loader instance for the whole hub.
 */
export class Loader {
	private readonly apps: Record<
		string,
		{ worker: Worker; actionPort: MessagePort; queryPort: MessagePort }
	> = {}

	constructor() {
		console.log("initializing loader")
		prisma.app
			.findMany({
				select: {
					id: true,
					last_version: { select: { version_number: true, multihash: true } },
				},
			})
			.then((apps) => {
				return Promise.all(
					apps.map(({ last_version }) => {
						if (!last_version) return
						console.log(last_version.multihash)
						return this.startApp(last_version.multihash)
					})
				)
			})
	}

	public startApp(multihash: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const worker = new Worker(path.resolve("worker.js"))
			const actionChannel = new MessageChannel()
			const queryChannel = new MessageChannel()

			worker.on("message", (message) => {
				if (message.status === "success") {
					this.apps[multihash] = {
						worker,
						actionPort: actionChannel.port2,
						queryPort: queryChannel.port2,
					}

					resolve()
				}
			})

			worker.postMessage(
				{
					multihash,
					actionPort: actionChannel.port1,
					queryPort: queryChannel.port1,
				},
				[actionChannel.port1, queryChannel.port1]
			)
		})
	}

	public stopApp(multihash: string): Promise<void> {
		return new Promise((resolve, reject) => {
			resolve()
		})
	}
}
