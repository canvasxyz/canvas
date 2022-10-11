import process from "node:process"
import path from "node:path"
import fs from "node:fs"

import yargs from "yargs"
import chalk from "chalk"
import prompts from "prompts"
import { getQuickJS } from "quickjs-emscripten"
import Hash from "ipfs-only-hash"

import { Core, MessageStore, SqliteStore } from "@canvas-js/core"

import { setupRpcs, locateSpec, confirmOrExit, getModelStore } from "../utils.js"
import { API } from "../api.js"

export const command = "run <spec>"
export const desc = "Run an app, by path or IPFS hash"

export const builder = (yargs: yargs.Argv) =>
	yargs
		.positional("spec", {
			describe: "Path to spec file, or IPFS hash of spec",
			type: "string",
			demandOption: true,
		})
		.option("database", {
			type: "string",
			desc: "Override database URI",
		})
		.option("port", {
			type: "number",
			desc: "Port to bind the core API",
			default: 8000,
		})
		.option("peering", {
			type: "boolean",
			desc: "Enable peering over libp2p GossipSub",
		})
		.option("peering-port", {
			type: "number",
			desc: "Port to bind libp2p TCP transport",
			default: 4044,
		})
		.option("ipfs", {
			type: "string",
			desc: "IPFS Gateway URL",
			default: "http://127.0.0.1:8080",
		})
		.option("noserver", {
			type: "boolean",
			desc: "Don't bind an Express server to provide view APIs",
		})
		.option("reset", {
			type: "boolean",
			desc: "Reset the message log and model databases",
			default: false,
		})
		.option("replay", {
			type: "boolean",
			desc: "Reconstruct the model database by replying the message log",
			default: false,
		})
		.option("unchecked", {
			type: "boolean",
			desc: "Run the node in unchecked mode, without verifying block hashes",
		})
		.option("verbose", {
			type: "boolean",
			desc: "Enable verbose logging",
			default: false,
		})
		.option("chain-rpc", {
			type: "array",
			desc: "Provide an RPC endpoint for reading on-chain data",
		})

type Args = ReturnType<typeof builder> extends yargs.Argv<infer T> ? T : never

export async function handler(args: Args) {
	// validate options
	if (args.replay && args.reset) {
		console.log(chalk.red("[canvas-cli] --replay and --reset cannot be used together"))
		process.exit(1)
	}

	const { name, directory, spec, peerId } = await locateSpec(args.spec, args.ipfs)

	if (directory === null) {
		if (args.peering) {
			console.log(chalk.red(`[canvas-cli] --peering cannot be enabled for local development specs`))
			process.exit(1)
		} else if (args.replay || args.reset) {
			console.log(chalk.red("[canvas-cli] --replay and --reset cannot be used with temporary development databases"))
			process.exit(1)
		}
	} else if (args.reset) {
		await confirmOrExit(`Are you sure you want to ${chalk.bold("erase all data")} in ${directory}?`)
		const messagesPath = path.resolve(directory, MessageStore.DATABASE_FILENAME)
		if (fs.existsSync(messagesPath)) {
			fs.rmSync(messagesPath)
			console.log(`[canvas-cli] Deleted ${messagesPath}`)
		}

		const modelsPath = path.resolve(directory, SqliteStore.DATABASE_FILENAME)
		if (fs.existsSync(modelsPath)) {
			fs.rmSync(modelsPath)
			console.log(`[canvas-cli] Deleted ${modelsPath}`)
		}

		const mstPath = path.resolve(directory, Core.MST_FILENAME)
		if (fs.existsSync(mstPath)) {
			fs.rmSync(mstPath)
			console.log(`[canvas-cli] Deleted ${mstPath}`)
		}

		if (args.database !== undefined) {
			console.log(`[canvas-cli] The provided database at ${args.database} was not changed.`)
		}
	} else if (args.replay) {
		await confirmOrExit(`Are you sure you want to ${chalk.bold("regenerate all model tables")} in ${directory}?`)
		const modelsPath = path.resolve(directory, SqliteStore.DATABASE_FILENAME)
		if (fs.existsSync(modelsPath)) {
			fs.rmSync(modelsPath)
			console.log(`[canvas-cli] Deleted ${modelsPath}`)
		}
	}

	// read rpcs from --chain-rpc arguments or environment variables
	// prompt to run in unchecked mode, if no rpcs were provided
	const rpc = setupRpcs(args["chain-rpc"])
	if (Object.keys(rpc).length === 0 && !args.unchecked) {
		const { confirm } = await prompts({
			type: "confirm",
			name: "confirm",
			message: chalk.yellow("No chain RPC provided. Run in unchecked mode instead?"),
			initial: true,
		})

		if (confirm) {
			args.unchecked = true
			args.peering = false
			console.log(
				chalk.yellow(
					`${chalk.bold("Running in unchecked mode.")} Block hashes will not be checked, and P2P will be disabled.`
				)
			)
		} else {
			console.log(chalk.red("No chain RPC provided! New actions cannot be processed without an RPC."))
		}
	}

	if (directory === null) {
		console.log(
			chalk.yellow(
				`${chalk.bold("Using development spec.")} To run in production mode, publish and run the spec from IPFS.`
			)
		)

		console.log(chalk.yellow.bold("Using in-memory model database. ") + chalk.yellow("All data will be lost on close."))
		console.log(chalk.red(`→ To persist data, run the spec from IPFS.`))

		const cid = await Hash.of(spec)
		console.log(
			chalk.red(`→ To publish the spec to IPFS, start ${chalk.bold("ipfs daemon")} in a separate window and run:`)
		)
		console.log(chalk.red.bold(`  ipfs add ${args.spec}`))
		console.log(chalk.red.bold(`  canvas run ${cid}`))
		console.log("")
	}

	const quickJS = await getQuickJS()

	const { database: databaseURI, verbose, replay, unchecked, peering, "peering-port": peeringPort } = args
	const store = getModelStore(databaseURI, directory, { verbose })

	let core: Core
	try {
		core = await Core.initialize({
			directory,
			name,
			spec,
			store,
			rpc,
			quickJS,
			verbose,
			replay,
			unchecked,
			peering,
			peeringPort,
			peerId,
		})
	} catch (err) {
		if (err instanceof Error) {
			console.log(chalk.red(err.message))
		} else {
			throw err
		}
		return
	}

	const api = args.noserver ? null : new API({ core, port: args.port, verbose })

	let stopping = false
	process.on("SIGINT", async () => {
		if (stopping) {
			process.exit(1)
		} else {
			stopping = true
			process.stdout.write(
				`\n${chalk.yellow("Received SIGINT, attempting to exit gracefully. ^C again to force quit.")}\n`
			)

			if (api !== null) {
				if (args.verbose) console.log("[canvas-cli] Stopping API server...")
				await api.stop()
				console.log("[canvas-cli] API server stopped.")
			}

			if (args.verbose) console.log("[canvas-cli] Closing core...")
			await core.close()
			core.modelStore.close() // not necessary (?)
			if (args.verbose) console.log("[canvas-cli] Core closed.")
		}
	})
}
