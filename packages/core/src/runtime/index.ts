import { SignerCache } from "@canvas-js/interfaces"

import { Contract as BaseContract } from "@canvas-js/core/contract"

import type { ContractClass } from "../types.js"
import { AbstractRuntime } from "./AbstractRuntime.js"

import { ClassContractRuntime } from "./ClassContractRuntime.js"
import { ClassFunctionRuntime } from "./ClassFunctionRuntime.js"

export { AbstractRuntime as Runtime } from "./AbstractRuntime.js"

export async function createRuntime(
	topic: string,
	signers: SignerCache,
	contract: string | ContractClass,
	options: { runtimeMemoryLimit?: number } = {},
): Promise<AbstractRuntime> {
	if (typeof contract === "string") {
		return ClassContractRuntime.init(topic, signers, contract, options)
	} else if (isContractClass(contract)) {
		return ClassFunctionRuntime.init(topic, signers, contract)
	} else {
		throw new Error("invalid contract class")
	}
}

function isContractClass(a: any): a is ContractClass {
	const prototype = Object.getPrototypeOf(a)
	if (prototype === null) {
		return false
	} else if (prototype === BaseContract) {
		return true
	} else {
		return isContractClass(prototype)
	}
}
