import type { Argv } from "yargs"

import chalk from "chalk"
import * as t from "io-ts"

import { actionType, sessionType } from "@canvas-js/core/codecs"
import { VM } from "@canvas-js/core/components/vm"

import { parseSpecArgument } from "../utils.js"

export const command = "info <app>"
export const desc = "Show the models, views, and actions for a app"

export const builder = (yargs: Argv) =>
	yargs.positional("app", {
		describe: "app filename or CID",
		type: "string",
		demandOption: true,
	})

type Args = ReturnType<typeof builder> extends Argv<infer T> ? T : never

export async function handler(args: Args) {
	const { uri, spec } = parseSpecArgument(args.app)

	try {
		const vm = await VM.initialize({ app: uri, spec, chains: [], unchecked: true })
		const { models, routes, actions, contractMetadata } = vm
		await vm.close()

		console.log(`name: ${uri}\n`)

		console.log(chalk.green("===== models ====="))
		console.log(`${JSON.stringify(models, null, "  ")}\n`)

		console.log(chalk.green("===== routes ====="))
		Object.keys(routes).forEach((route) => console.log(`GET ${route}`))
		console.log("POST /sessions")
		console.log(printType(sessionType))
		console.log("POST /actions")
		console.log(printType(actionType))
		console.log("")

		console.log(chalk.green("===== actions ====="))
		console.log(actions.map((name) => `${name}({ ...args })\n`).join(""))

		console.log(chalk.green("===== contracts ====="))
		Object.entries(contractMetadata).forEach(([name, { chain, address, abi }]) => {
			console.log(`${name}: ${address} on ${chain}`)
			abi.forEach((line) => console.log(`- ${line}`))
		})
		console.log("")
	} catch (err) {
		if (err instanceof Error) {
			console.log(chalk.red(err.message))
		} else {
			throw err
		}
	}

	process.exit(0)
}

function printType<T>(type: t.Type<T>, indent = ""): string {
	if (type instanceof t.InterfaceType) {
		const props = Object.entries<t.Type<any>>(type.props).map(
			([name, prop]) => `${indent}  ${name}: ${printType(prop, indent + "  ")}\n`
		)

		return `{\n${props.join("") + indent}}`
	} else if (type instanceof t.IntersectionType) {
		const props: string[] = []
		for (const child of type.types) {
			if (child instanceof t.InterfaceType) {
				for (const [name, prop] of Object.entries<t.Type<any>>(child.props)) {
					props.push(`${indent}  ${name}: ${printType(prop, indent + "  ")}\n`)
				}
			} else if (child instanceof t.PartialType) {
				for (const [name, prop] of Object.entries<t.Type<any>>(child.props)) {
					props.push(`${indent}  ${name}?: ${printType(prop, indent + "  ")}\n`)
				}
			}
		}
		return `{\n${props.join("") + indent}}`
	} else {
		return chalk.green(type.name)
	}
}
