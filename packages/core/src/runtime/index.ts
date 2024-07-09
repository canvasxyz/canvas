import { SignerCache } from "@canvas-js/interfaces"
import type pg from "pg"

import type { Contract } from "../types.js"
import { AbstractRuntime } from "./AbstractRuntime.js"
import { ContractRuntime } from "./ContractRuntime.js"
import { FunctionRuntime } from "./FunctionRuntime.js"

export { AbstractRuntime as Runtime } from "./AbstractRuntime.js"

export async function createRuntime(
	location: string | pg.ConnectionConfig | null,
	topic: string,
	signers: SignerCache,
	contract: string | Contract,
	options: { runtimeMemoryLimit?: number } = {},
): Promise<AbstractRuntime> {
	if (typeof contract === "string") {
		return ContractRuntime.init(location, topic, signers, contract, options)
	} else {
		return FunctionRuntime.init(location, topic, signers, contract)
	}
}
