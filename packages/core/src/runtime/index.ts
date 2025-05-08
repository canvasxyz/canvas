import { SignerCache } from "@canvas-js/interfaces"

import { Contract as BaseContract } from "@canvas-js/core/contract"

import type { ClassContract, Contract } from "../types.js"
import { AbstractRuntime } from "./AbstractRuntime.js"
import { ContractRuntime } from "./ContractRuntime.js"
import { FunctionRuntime } from "./FunctionRuntime.js"
import { ClassContractRuntime } from "./ClassContractRuntime.js"
import { ClassFunctionRuntime } from "./ClassFunctionRuntime.js"

export { AbstractRuntime as Runtime } from "./AbstractRuntime.js"

export async function createRuntime(
	topic: string,
	signers: SignerCache,
	contract: string | Contract<any> | ClassContract<any>,
	options: { runtimeMemoryLimit?: number } = {},
): Promise<AbstractRuntime> {
	if (typeof contract === "string") {
		if (contract.indexOf("export default class") !== -1) {
			return ClassContractRuntime.init(topic, signers, contract, options)
		} else {
			return ContractRuntime.init(topic, signers, contract, options)
		}
	} else if (isContractClass(contract)) {
		return ClassFunctionRuntime.init(topic, signers, contract)
	} else {
		return FunctionRuntime.init(topic, signers, contract)
	}
}

function isContractClass(a: any): a is ClassContract<any> {
	const prototype = Object.getPrototypeOf(a)
	if (prototype === null) {
		return false
	} else if (prototype === BaseContract) {
		return true
	} else {
		return isContractClass(prototype)
	}
}
