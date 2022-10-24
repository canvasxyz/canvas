import yargs from "yargs"
import chalk from "chalk"
import * as t from "io-ts"

import { actionType, sessionType, VM } from "@canvas-js/core"

import { locateSpec } from "../utils.js"

export const command = "info <spec>"
export const desc = "Show the models, views, and actions for a spec"

export const builder = (yargs: yargs.Argv) =>
	yargs
		.positional("spec", {
			describe: "Path to spec file, or IPFS hash of spec",
			type: "string",
			demandOption: true,
		})
		.option("ipfs", {
			type: "string",
			desc: "IPFS HTTP API URL",
			default: "http://localhost:5001",
		})

type Args = ReturnType<typeof builder> extends yargs.Argv<infer T> ? T : never

export async function handler(args: Args) {
	const { uri, spec } = await locateSpec(args.spec, args.ipfs)

	const vm = await VM.initialize(uri, spec, {}, { unchecked: true })
	const { models, routeParameters, actionParameters, contractMetadata } = vm
	vm.dispose()

	console.log(`name: ${name}\n`)

	console.log(chalk.green("===== models ====="))
	console.log(`${JSON.stringify(models, null, "  ")}\n`)

	console.log(chalk.green("===== routes ====="))
	Object.keys(routeParameters).forEach((route) => console.log(`GET ${route}`))
	console.log("POST /sessions")
	console.log(printType(sessionType))
	console.log("POST /actions")
	console.log(printType(actionType))
	console.log("")

	console.log(chalk.green("===== actions ====="))
	console.log(
		Object.entries(actionParameters)
			.map(([name, params]) => `${name}(${params.join(", ")})\n`)
			.join("")
	)

	console.log(chalk.green("===== contracts ====="))
	Object.entries(contractMetadata).forEach(([name, { chain, chainId, address, abi }]) => {
		console.log(`${name}: ${address} on ${chain} ${chainId}`)
		abi.forEach((line) => console.log(`- ${line}`))
	})
	console.log("")

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
