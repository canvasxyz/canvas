import { SignerCache } from "@canvas-js/interfaces"

import type { ContractClass } from "../types.js"
import { AbstractRuntime } from "./AbstractRuntime.js"

import { ClassContractRuntime } from "./ClassContractRuntime.js"
import { ClassFunctionRuntime } from "./ClassFunctionRuntime.js"
import { JSValue } from "@canvas-js/utils"

export { AbstractRuntime as Runtime } from "./AbstractRuntime.js"

export async function createRuntime(
	contract: string | ContractClass,
	args: JSValue[],
	signers: SignerCache,
	options: { runtimeMemoryLimit?: number } = {},
): Promise<AbstractRuntime> {
	if (typeof contract === "string") {
		return ClassContractRuntime.init(contract, args, signers, options)
	} else {
		return ClassFunctionRuntime.init(contract, args, signers)
	}
}
