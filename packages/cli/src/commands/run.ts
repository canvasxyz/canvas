import process from "node:process"
import type { Argv } from "yargs"
import dotenv from "dotenv"

dotenv.config()

import { MAX_CONNECTIONS } from "@canvas-js/core/constants"
import { Snapshot } from "@canvas-js/core"
import { AppInstance } from "../AppInstance.js"
import { getContractLocation } from "../utils.js"

export const command = "run <path>"
export const desc = "Run a Canvas application"

const { ANNOUNCE, LISTEN, PORT } = process.env

export const builder = (yargs: Argv) =>
	yargs
		.positional("path", {
			desc: "Path to application directory or *.js/*.ts contract",
			type: "string",
			demandOption: true,
		})
		.option("topic", {
			desc: "Application topic",
			type: "string",
		})
		.option("init", {
			desc: "Path to a contract to copy if the application directory does not exist",
			type: "string",
		})
		.option("port", {
			desc: "HTTP API port",
			type: "number",
			default: parseInt(PORT ?? "8000"),
		})
		.option("offline", {
			type: "boolean",
			desc: "Disable libp2p",
			default: false,
		})
		.option("listen", {
			type: "array",
			desc: "Internal /ws multiaddr",
			default: LISTEN?.split(" ") ?? ["/ip4/0.0.0.0/tcp/4444/ws"],
			string: true,
		})
		.option("announce", {
			type: "array",
			desc: "External /ws multiaddr, e.g. /dns4/myapp.com/tcp/4444/ws",
			default: ANNOUNCE?.split(" ") ?? [],
			string: true,
		})
		// .option("replay", {
		// 	type: "boolean",
		// 	desc: "Erase and rebuild the database by replaying the action log",
		// 	default: false,
		// })
		// .option("memory", {
		// 	type: "boolean",
		// 	desc: "Run in-memory",
		// 	default: false,
		// })
		// .option("metrics", {
		// 	type: "boolean",
		// 	desc: "Expose Prometheus endpoint at /metrics",
		// 	default: false,
		// })
		.option("static", {
			type: "string",
			desc: "Serve a static directory from the root path /",
		})
		.option("bootstrap", {
			type: "array",
			desc: "Initial application peers, e.g. /dns4/myapp.com/tcp/4444/ws/p2p/12D3KooWnzt...",
			string: true,
		})
		.option("max-connections", {
			type: "number",
			desc: "Stop accepting connections above a limit",
			default: MAX_CONNECTIONS,
		})
		.option("verbose", {
			type: "boolean",
			desc: "Log messages to stdout",
		})
		.option("disable-http-api", {
			type: "boolean",
			desc: "Disable HTTP API server",
		})
		.option("repl", {
			type: "boolean",
			desc: "Start an action REPL",
			default: false,
		})
		.option("network-explorer", {
			type: "boolean",
			desc: "Serve the network explorer web interface",
		})
		.option("admin", {
			type: "boolean",
			desc: "Allow an admin address to update the running application",
		})
		.option("connect", {
			type: "string",
			desc: "Connect GossipLog directly to this WebSocket URL. If this is enabled, libp2p is disabled.",
		})

type Args = ReturnType<typeof builder> extends Argv<infer T> ? T : never

export async function handler(args: Args) {
	const { topic, contract, location } = await getContractLocation(args)

	// TODO: Add authentication
	const bindRestartAPI = (instance: AppInstance) => {
		if (!instance.api) return
		instance.api.post("/api/migrate", (req, res) => {
			const { contract, changesets } = req.body ?? {}
			console.log("migrating app with changesets:", contract, changesets)

			instance.app
				.createSnapshot()
				.then(async (snapshot: Snapshot) => {
					res.json({ status: "Success" })
					console.log("[canvas] Restarting...")
					await instance.stop()

					/** Restart the application, running the "new" contract */
					setTimeout(async () => {
						const instance = await AppInstance.initialize(topic, contract, location, args)
						bindRestartAPI(instance)
					}, 0)
				})
				.catch((error) => {
					res.status(500).end()
				})
		})
	}

	const instance = await AppInstance.initialize(topic, contract, location, args)

	if (instance.api) {
		// AppInstance should always have an api unless it was initialized with --disable-http-api
		instance.api.get("/api/contract", async (req, res) => {
			res.json({
				contract: instance.app.getContract().toString(),
				admin: args.admin !== undefined && args.admin !== false,
			})
		})

		if (args.admin) {
			bindRestartAPI(instance)
		}
	}
}
