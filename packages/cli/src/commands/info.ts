import fs from "node:fs"
import path from "node:path"

import yargs from "yargs"
import chalk from "chalk"
import * as t from "io-ts"

import { actionType, constants, sessionType, VM } from "@canvas-js/core"

import { parseSpecArgument } from "../utils.js"
import { isRight } from "fp-ts/lib/Either.js"

export const command = "info <spec>"
export const desc = "Show the models, views, and actions for a spec"

export const builder = (yargs: yargs.Argv) =>
	yargs.positional("spec", {
		describe: "spec filename or CID",
		type: "string",
		demandOption: true,
	})

type Args = ReturnType<typeof builder> extends yargs.Argv<infer T> ? T : never

export async function handler(args: Args) {
	const { uri, directory } = parseSpecArgument(args.spec)

	let spec: string
	if (directory !== null) {
		const specPath = path.resolve(directory, constants.SPEC_FILENAME)
		if (fs.existsSync(specPath)) {
			spec = fs.readFileSync(specPath, "utf-8")
		} else {
			console.log(chalk.yellow(`[canvas-cli] The spec ${args.spec} is not installed locally.`))
			console.log(chalk.yellow(`[canvas-cli] Try runing "canvas install ${args.spec}"`))
			process.exit(1)
		}
	} else {
		spec = fs.readFileSync(args.spec, "utf-8")
	}

	const vmValidation = await VM.initialize({ uri, spec, unchecked: true })
	if (isRight(vmValidation)) {
		const { models, routes, actions, contractMetadata } = vmValidation.right
		vmValidation.right.dispose()

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
		Object.entries(contractMetadata).forEach(([name, { chain, chainId, address, abi }]) => {
			console.log(`${name}: ${address} on ${chain} ${chainId}`)
			abi.forEach((line) => console.log(`- ${line}`))
		})
		console.log("")
	} else {
		// print errors
		for (const error of vmValidation.left) {
			if (error.message) {
				console.log(chalk.red(error.message))
			}
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
