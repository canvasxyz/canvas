import { SignerCache } from "@canvas-js/interfaces"

import type { Contract, ModelSchema } from "../types.js"
import { AbstractRuntime } from "./AbstractRuntime.js"
import { ContractRuntime } from "./ContractRuntime.js"
import { FunctionRuntime } from "./FunctionRuntime.js"

export { AbstractRuntime as Runtime } from "./AbstractRuntime.js"

export async function createRuntime(
	topic: string,
	signers: SignerCache,
	contract: string | Contract<any>,
	options: { runtimeMemoryLimit?: number } = {},
): Promise<AbstractRuntime> {
	if (typeof contract === "string") {
		return await ContractRuntime.init(topic, signers, contract, options)
	} else {
		return await FunctionRuntime.init(topic, signers, contract)
	}
}
