import process from "node:process"
import crypto from "node:crypto"
import * as cbor from "@ipld/dag-cbor"
import type { Argv } from "yargs"
import dotenv from "dotenv"
import { SiweMessage } from "siwe"
import { verifyMessage } from "ethers"

dotenv.config()

import { Canvas, hashSnapshot } from "@canvas-js/core"
import { MAX_CONNECTIONS } from "@canvas-js/core/constants"
import { Snapshot } from "@canvas-js/core"
import { AppInstance } from "../AppInstance.js"
import { writeContract, writeSnapshot, clearSnapshot, getContractLocation, clearContractLocationDB } from "../utils.js"
import { startActionPrompt } from "../prompt.js"

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
		.option("baseTopic", {
			alias: "topic",
			desc: "Application topic, e.g. my-app.example.com",
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
		.option("replay", {
			type: "boolean",
			desc: "Erase and rebuild the database by replaying the action log",
			default: false,
		})
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
			type: "string",
			desc: "Allow an admin address (Ethereum address or 'any') to update the running application",
		})
		.option("connect", {
			type: "string",
			desc: "Connect GossipLog directly to this WebSocket URL. If this is enabled, libp2p is disabled.",
		})

type Args = ReturnType<typeof builder> extends Argv<infer T> ? T : never

export async function handler(args: Args) {
	const { baseTopic, contract, originalContract, location, snapshot } = await getContractLocation(args)

	let updatedContract: string = originalContract // updated, pre-esbuild version of the running contract
	let updatedBuild: string = contract // updated, built version of the running contract
	let updatedSnapshot: Snapshot | null = snapshot ?? null // updated version of the snapshot

	if (args.admin && args.admin !== "any") {
		const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/
		if (!ethAddressRegex.test(args.admin)) {
			console.error("Error: --admin must be a valid Ethereum address or 'any'")
			process.exit(1)
		}
	}

	const bindInstanceAPIs = (instance: AppInstance) => {
		// AppInstance should always have an api unless it was initialized with --disable-http-api
		if (!instance.api) return

		// Nonce for SIWE signing.
		const nonce = crypto.randomBytes(32).toString("hex")

		instance.api.get("/api/contract", async (_req, res) => {
			res.json({
				inMemory: location === null,
				originalContract: updatedContract,
				contract: instance.app.getContract().toString(),
				admin: args.admin || false,
				nonce: nonce,
				snapshotHash: updatedSnapshot ? hashSnapshot(updatedSnapshot) : null,
			})
		})

		instance.api.get("/api/snapshot", async (_req, res) => {
			res.writeHead(200, { "Content-Type": "application/cbor" })
			res.end(cbor.encode(updatedSnapshot))
		})

		if (args.admin) {
			const adminAddress = args.admin
			instance.api.post("/api/migrate", async (req, res) => {
				const { newContract, changesets, address, signature, siweMessage, includeSnapshot } = req.body ?? {}

				if (address !== adminAddress && adminAddress !== "any") {
					return res.status(403).json({
						error: "Unauthorized: Only the configured admin address can perform migrations",
					})
				}

				// Verify SIWE signature
				try {
					if (!signature || !siweMessage) {
						return res.status(400).json({
							error: "Missing signature or SIWE message",
						})
					}
					const message = new SiweMessage(siweMessage)

					if (!message.nonce || message.nonce !== nonce) {
						return res.status(403).json({
							error: "Invalid nonce in SIWE message",
						})
					}

					const recoveredAddress = verifyMessage(message.prepareMessage(), signature)
					if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
						return res.status(403).json({
							error: "Signature verification failed",
						})
					}

					// Verify the signature matches the admin address (duplicate check)
					if (adminAddress !== "any" && recoveredAddress.toLowerCase() !== adminAddress.toLowerCase()) {
						return res.status(403).json({
							error: "Signature verification failed",
						})
					}

					// We're trusting the client to provide a `contract` file that can be written to disk.
					// Since contract execution is containerized, we only need to enforce max contract sizes,
					// and max heap sizes in the Node.js host, for this to be safe.
					const { build } = await Canvas.buildContract(newContract)
					if (location !== null) {
						writeContract({
							location,
							baseTopic,
							build,
							originalContract: newContract,
						})
					}

					// In-memory contract changes will not be persisted, except in this variable.
					updatedContract = newContract
					updatedBuild = build

					console.log(
						`[canvas] ${includeSnapshot ? "snapshotting and " : ""}migrating app with changesets:`,
						changesets,
					)

					instance.app
						.createSnapshot()
						.then(async (snapshot: Snapshot) => {
							console.log("[canvas] Stopping existing instance...")
							await instance.stop()

							if (location !== null) {
								console.log("[canvas] Rewriting application on disk...")
								if (includeSnapshot) {
									await writeSnapshot({ location, snapshot })
								} else {
									await clearSnapshot({ location })
								}
								clearContractLocationDB({ location })
							}

							updatedSnapshot = includeSnapshot ? snapshot : null

							// Restart the application, running the new, compiled contract.
							console.log("[canvas] Restarting...")
							await new Promise((resolve) => setTimeout(resolve, 0))
							const newInstance = await AppInstance.initialize({
								baseTopic,
								contract: updatedBuild,
								location,
								snapshot: includeSnapshot ? snapshot : null,
								reset: true,
								config: args,
							})
							bindInstanceAPIs(newInstance)
							res.json({ status: "Success" })
						})
						.catch((error) => {
							console.error(error)
							res.status(500).end()
						})
				} catch (error) {
					console.error("Signature verification error:", error)
					return res.status(403).json({
						error: "Signature verification failed",
					})
				}
			})
		}
	}

	const instance = await AppInstance.initialize({ baseTopic, contract, location, snapshot, config: args })

	bindInstanceAPIs(instance)

	if (args.replay) {
		console.log("[canvas] Replaying message log...")
		await instance.app.replay().then((complete) => {
			if (complete) {
				console.log("[canvas] Replay complete!")
			} else {
				console.log("[canvas] Replay aborted before completing and will resume the next time the app is opened.")
			}
		})
	}

	if (args.repl) {
		await startActionPrompt(instance.app)
	}
}
