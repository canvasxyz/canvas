// import fs from "node:fs"
import process from "node:process"

import yargs from "yargs"
import chalk from "chalk"
import prompts from "prompts"

import { getQuickJS } from "quickjs-emscripten"
import { create as createIpfsHttpClient, IPFSHTTPClient } from "ipfs-http-client"
import Hash from "ipfs-only-hash"

import { Core } from "@canvas-js/core"

import { API } from "../api.js"
import { setupRpcs, locateSpec, confirmOrExit, defaultDatabaseURI, getStore } from "../utils.js"

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
			desc: "Enable peering over IPFS PubSub",
		})
		.option("ipfs", {
			type: "string",
			desc: "IPFS HTTP API URL",
			default: "http://localhost:5001",
		})
		.option("noserver", {
			type: "boolean",
			desc: "Don't bind an Express server to provide view APIs",
		})
		.option("reset", {
			type: "boolean",
			desc: "Reset the action log and model database",
			default: false,
		})
		.option("replay", {
			type: "boolean",
			desc: "Reconstruct the model database by replying the action log",
			default: false,
		})
		.option("unchecked", {
			type: "boolean",
			desc: "Run the node in unchecked mode, without verifying block hashes",
		})
		.option("watch", {
			type: "boolean",
			desc: "Restart the core on spec file changes",
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
		console.error(chalk.red("[canvas-cli] --replay and --reset cannot be used together"))
		process.exit(1)
	}

	const { name, directory, specPath, spec } = await locateSpec(args.spec, args.ipfs)

	const development = directory === null
	const databaseURI = args.database || defaultDatabaseURI(directory)

	if (!development && args.watch) {
		console.log(chalk.yellow(`[canvas-cli] --watch has no effect on CID specs`))
	}

	if (development && args.peering) {
		console.error(chalk.red(`[canvas-cli] --peering cannot be enabled for local development specs`))
		process.exit(1)
	}

	if (databaseURI === null) {
		if (args.replay || args.reset) {
			console.error(chalk.red("[canvas-cli] --replay and --reset cannot be used with temporary development databases"))
			process.exit(1)
		}
	} else {
		if (args.reset) {
			await confirmOrExit(`Are you sure you want to ${chalk.bold("erase all data")} in ${databaseURI}?`)
		} else if (args.replay) {
			await confirmOrExit(`Are you sure you want to ${chalk.bold("regenerate all model tables")} in ${databaseURI}?`)
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
		})

		if (confirm) {
			args.unchecked = true
			args.peering = false
			console.log(
				chalk.yellow.bold("Running in unchecked mode. ") +
					chalk.yellow("Block hashes will not be checked, and P2P will be disabled.")
			)
		} else {
			console.log(chalk.red("No chain RPC provided! New actions cannot be processed without an RPC."))
		}
	}

	const quickJS = await getQuickJS()

	let ipfs: IPFSHTTPClient | undefined = undefined
	let peerID: string | undefined = undefined
	if (args.peering) {
		ipfs = createIpfsHttpClient({ url: args.ipfs })
		const { id } = await ipfs.id()
		peerID = id.toString()
		console.log(chalk.yellow(`Peering enabled, using local IPFS peer ID ${peerID}`))
	}

	if (databaseURI) {
		console.log(chalk.yellow(chalk.bold("Using database: " + databaseURI.replace(/^file:/, ""))))
	}
	if (!databaseURI && development) {
		console.log(chalk.yellow.bold("Using in-memory database. ") + chalk.yellow("All data will be lost on close."))
	}

	if (development) {
		console.log(
			chalk.yellow(
				chalk.bold("Using development spec. ") + "To run in production mode, publish and run the spec from IPFS."
			)
		)
	}

	if (development) {
		console.log("")
	}
	if (!databaseURI && development) {
		console.log(
			chalk.red(
				"→ To persist data, add a database with " +
					chalk.bold("--database file:db.sqlite") +
					", or run the spec from IPFS."
			)
		)
	}

	if (development) {
		const cid = await Hash.of(spec)
		console.log(
			chalk.red("→ To publish the spec to IPFS, start " + chalk.bold("ipfs daemon") + " in a separate window and run:")
		)
		console.log(chalk.red.bold(`  ipfs add ${args.spec}`))
		console.log(chalk.red.bold(`  canvas run ${cid}`))
		console.log("")
	}

	const store = getStore(databaseURI, directory, { verbose: args.verbose })
	const core = await Core.initialize({
		store,
		directory,
		name,
		spec,
		verbose: args.verbose,
		quickJS,
		replay: args.replay,
		unchecked: args.unchecked,
		rpc,
	})

	if (!args.noserver) {
		const api = new API({ peerID, core, port: args.port, ipfs, peering: args.peering })
	}

	// let core: Core, api: API
	// try {
	// 	core = await Core.initialize({
	// 		store,
	// 		directory,
	// 		name,
	// 		spec,
	// 		verbose: args.verbose,
	// 		quickJS,
	// 		replay: args.replay,
	// 		unchecked: args.unchecked,
	// 		rpc,
	// 	})

	// 	if (!args.noserver) {
	// 		api = new API({ peerID, core, port: args.port, ipfs, peering: args.peering })
	// 	}
	// } catch (err) {
	//  console.log(chalk.red(err))
	// 	// don't terminate on error
	// }

	// let core: Core, api: API
	// try {
	// 	core = await Core.initialize({
	// 		store,
	// 		directory,
	// 		name,
	// 		spec,
	// 		verbose: args.verbose,
	// 		quickJS,
	// 		replay: args.replay,
	// 		unchecked: args.unchecked,
	// 		rpc,
	// 	})

	// 	if (!args.noserver) {
	// 		api = new API({ peerID, core, port: args.port, ipfs, peering: args.peering })
	// 	}
	// } catch (err) {
	// 	console.log(err)
	// 	// don't terminate on error
	// }

	// if (!args.watch || !development) {
	// 	return
	// }

	if (databaseURI === null) {
		console.log(
			chalk.yellow(
				"[canvas-cli] Warning: the action log will be erased on every change to the spec file. All data will be lost."
			)
		)
	} else if (args.reset) {
		console.log(
			chalk.yellow(
				"[canvas-cli] Warning: the action log will be erased on every change to the spec file. All data will be lost."
			)
		)
	} else if (args.replay) {
		console.log(
			chalk.yellow(
				"[canvas-cli] Warning: the model database will be rebuilt from the action log on every change to the spec file."
			)
		)
	}

	// let terminating = false
	// let oldSpec = spec
	// fs.watch(specPath, async (event, filename) => {
	// 	if (terminating || !filename || event !== "change") {
	// 		return
	// 	}

	// 	const newSpec = fs.readFileSync(specPath, "utf-8")
	// 	if (newSpec !== oldSpec) {
	// 		console.log(chalk.yellow("File changed, restarting core...\n"))
	// 		oldSpec = newSpec
	// 		terminating = true
	// 		try {
	// 			if (!args.noserver) {
	// 				await api?.stop()
	// 			}
	// 			await core.close()
	// 		} catch (err) {
	// 			// continue if the api or core crashed during the last reload
	// 		}

	// 		try {
	// 			core = await Core.initialize({
	// 				name,
	// 				spec: newSpec,
	// 				databaseURI,
	// 				quickJS,
	// 				replay: args.replay,
	// 				reset: args.reset,
	// 			})

	// 			if (!args.noserver) {
	// 				api = new API({ core, port: args.port, ipfs, peering: args.peering })
	// 			}
	// 		} catch (err) {
	// 			console.log(err)
	// 			// don't terminate on error
	// 		}

	// 		terminating = false
	// 	}
	// })
}
