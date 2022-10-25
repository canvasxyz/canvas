import process from "node:process"
import path from "node:path"
import fs from "node:fs"

import yargs from "yargs"
import chalk from "chalk"
import prompts from "prompts"
import Hash from "ipfs-only-hash"

import { Core, constants, actionType, Driver } from "@canvas-js/core"

import { setupRpcs, confirmOrExit, CANVAS_HOME, parseSpecArgument } from "../utils.js"
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
		.option("port", {
			type: "number",
			desc: "Port to bind the core API",
			default: 8000,
		})
		.option("offline", {
			type: "boolean",
			desc: "Disable libp2p",
		})
		.option("peering-port", {
			type: "number",
			desc: "Port to bind libp2p WebSocket transport",
			default: 4044,
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

	const { uri, directory } = parseSpecArgument(args.spec)

	if (directory === null) {
		if (args.replay || args.reset) {
			console.log(chalk.red("[canvas-cli] --replay and --reset cannot be used with temporary development databases"))
			process.exit(1)
		}
	} else {
		if (!fs.existsSync(directory)) {
			console.log(`[canvas-cli] Creating new directory ${directory}`)
			fs.mkdirSync(directory)
		} else if (args.reset) {
			await confirmOrExit(`Are you sure you want to ${chalk.bold("erase all data")} in ${directory}?`)
			const messagesPath = path.resolve(directory, constants.MESSAGE_DATABASE_FILENAME)
			if (fs.existsSync(messagesPath)) {
				fs.rmSync(messagesPath)
				console.log(`[canvas-cli] Deleted ${messagesPath}`)
			}

			const modelsPath = path.resolve(directory, constants.MODEL_DATABASE_FILENAME)
			if (fs.existsSync(modelsPath)) {
				fs.rmSync(modelsPath)
				console.log(`[canvas-cli] Deleted ${modelsPath}`)
			}

			const mstPath = path.resolve(directory, constants.MST_FILENAME)
			if (fs.existsSync(mstPath)) {
				fs.rmSync(mstPath)
				console.log(`[canvas-cli] Deleted ${mstPath}`)
			}
		} else if (args.replay) {
			await confirmOrExit(`Are you sure you want to ${chalk.bold("regenerate all model tables")} in ${directory}?`)
			const modelsPath = path.resolve(directory, constants.MODEL_DATABASE_FILENAME)
			if (fs.existsSync(modelsPath)) {
				fs.rmSync(modelsPath)
				console.log(`[canvas-cli] Deleted ${modelsPath}`)
			}
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
			args.offline = true
			console.log(chalk.yellow(`✦ ${chalk.bold("Using unchecked mode.")} Actions will not require a valid block hash.`))
		} else {
			console.log(chalk.red("No chain RPC provided! New actions cannot be processed without an RPC."))
		}
	}

	if (directory === null) {
		console.log(
			chalk.yellow(
				`✦ ${chalk.bold("Using development mode.")} Actions will be signed with the spec's filename, not IPFS hash.`
			)
		)
		console.log(chalk.yellow(`✦ ${chalk.bold("Using in-memory model database.")} Data will not be saved between runs.`))
		console.log(chalk.yellow(`✦ To persist data, install the spec with:`))
		console.log(chalk.yellow(`  canvas install ${args.spec}`))
		console.log("")
	}

	const { replay, verbose, unchecked, offline, "peering-port": peeringPort } = args

	const driver = await Driver.initialize({ rootDirectory: CANVAS_HOME, port: peeringPort, rpc })

	let core: Core
	try {
		core = await driver.start(uri, { unchecked, verbose, offline })
	} catch (err) {
		if (err instanceof Error) {
			console.log(chalk.red(err.message))
		} else {
			throw err
		}
		return
	}

	if (directory !== null && replay) {
		console.log(chalk.green(`[canvas-core] Replaying action log...`))

		let i = 0
		for await (const [id, action] of core.messageStore.getActionStream()) {
			if (!actionType.is(action)) {
				console.log(chalk.red("[canvas-core]"), action)
				throw new Error("Invalid action value in action log")
			}

			const effects = await core.vm.execute(id, action.payload)
			core.modelStore.applyEffects(action.payload, effects)
			i++
		}

		console.log(chalk.green(`[canvas-core] Successfully replayed all ${i} entries from the action log.`))
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
			await driver.close()
			if (args.verbose) console.log("[canvas-cli] Core closed.")
		}
	})
}
