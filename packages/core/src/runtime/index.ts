import { SessionSigner } from "@canvas-js/interfaces"
import { ModelsInit } from "@canvas-js/modeldb"

import { PlatformTarget } from "../targets/interface.js"
import { AbstractRuntime } from "./AbstractRuntime.js"
import { ContractRuntime } from "./ContractRuntime.js"
import { FunctionRuntime } from "./FunctionRuntime.js"
import { ActionImplementation } from "./types.js"

export { AbstractRuntime as Runtime } from "./AbstractRuntime.js"
export * from "./types.js"

export async function initRuntime(
	target: PlatformTarget,
	signers: SessionSigner[],
	contract: string | { topic: string; models: ModelsInit; actions: Record<string, ActionImplementation> },
	options: { runtimeMemoryLimit?: number; indexHistory?: boolean } = {}
): Promise<AbstractRuntime> {
	if (typeof contract === "string") {
		return ContractRuntime.init(target, signers, contract, options)
	} else {
		return FunctionRuntime.init(target, signers, contract)
	}
}
