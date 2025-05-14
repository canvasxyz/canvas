import PQueue from "p-queue"

import type { SignerCache } from "@canvas-js/interfaces"
import { DeriveModelTypes } from "@canvas-js/modeldb"
import { assert } from "@canvas-js/utils"
import { encodeId } from "@canvas-js/gossiplog"
import { bytesToHex } from "@noble/hashes/utils"
import { sha256 } from "@noble/hashes/sha256"

import { ModelSchema, ActionContext, ActionImplementation, Contract, ModelAPI } from "../types.js"
import { ExecutionContext } from "../ExecutionContext.js"
import { AbstractRuntime } from "./AbstractRuntime.js"
import { generateActionsFromRules } from "./rules.js"

// Check if all models have $rules defined
const hasAllRules = (models: ModelSchema) => {
	return Object.values(models).every((model) => "$rules" in model)
}
const hasNoRules = (models: ModelSchema) => {
	return Object.values(models).every((model) => !("$rules" in model))
}

export class FunctionRuntime<ModelsT extends ModelSchema> extends AbstractRuntime {
	public static async init<ModelsT extends ModelSchema>(
		topic: string,
		signers: SignerCache,
		contract: Contract<ModelsT>,
	): Promise<FunctionRuntime<ModelsT>> {
		assert(contract.models !== undefined, "contract initialized without models")
		assert(
			contract.actions !== undefined || hasAllRules(contract.models),
			"contracts without actions must have $rules on all models",
		)
		assert(
			hasNoRules(contract.models) || hasAllRules(contract.models),
			"contracts with rules must have them on all models",
		)
		assert(
			Object.keys(contract.models).every((key) => !key.startsWith("$")),
			"contract model names cannot start with '$'",
		)

		return new FunctionRuntime(topic, signers, contract)
	}

	public readonly contract: string
	public readonly actions: Record<string, ActionImplementation<ModelsT, any>>

	#context: ExecutionContext | null = null
	#txnId = 0
	#nextId: Uint8Array | null = null
	#transaction = false
	#thisValue: ActionContext<DeriveModelTypes<ModelsT>> | null = null
	#queue = new PQueue({ concurrency: 1 })
	#db: ModelAPI<DeriveModelTypes<ModelsT>>

	constructor(
		public readonly topic: string,
		public readonly signers: SignerCache,
		contract: Contract<ModelsT>,
	) {
		super(contract.models)
		this.actions = contract.actions ?? generateActionsFromRules(this.rules, contract.models)
		this.contract = [
			`export const models = ${JSON.stringify(contract.models, null, "  ")};`,
			`export const actions = {\n${Object.entries(this.actions)
				.map(([name, action]) => `${name}: ${action}`)
				.join(", \n")}};`,
		].join("\n")

		this.#db = {
			get: async <T extends keyof DeriveModelTypes<ModelsT> & string>(model: T, key: string) => {
				const result = await this.#queue.add(() =>
					this.context.getModelValue<DeriveModelTypes<ModelsT>[T]>(model, key, this.#transaction),
				)
				return result ?? null
			},

			set: (model, value) => this.#queue.add(() => this.context.setModelValue(model, value, this.#transaction)),
			update: (model, value) => this.#queue.add(() => this.context.updateModelValue(model, value, this.#transaction)),
			merge: (model, value) => this.#queue.add(() => this.context.mergeModelValue(model, value, this.#transaction)),
			create: (model, value) => this.#queue.add(() => this.context.createModelValue(model, value, this.#transaction)),
			delete: (model, key) => this.#queue.add(() => this.context.deleteModelValue(model, key, this.#transaction)),
			link: (modelProperty, source, target) =>
				this.#queue.add(() => this.context.linkModelValue(modelProperty, source, target, this.#transaction)),
			unlink: (modelProperty, source, target) =>
				this.#queue.add(() => this.context.unlinkModelValue(modelProperty, source, target, this.#transaction)),

			transaction: async (callback) => {
				if (this.#txnId > 0) {
					throw new Error("transaction(...) can only be called once per action")
				}

				try {
					this.#transaction = true
					this.#txnId += 1
					return await callback.apply(this.thisValue, [])
				} finally {
					await this.#queue.onIdle()
					this.#transaction = false
				}
			},

			id: () => {
				if (this.#nextId === null) throw new Error("expected this.#nextId !== null")
				this.#nextId = sha256(this.#nextId)
				return bytesToHex(this.#nextId.slice(0, 16))
			},

			random: () => {
				if (this.#nextId === null) throw new Error("expected this.#nextId !== null")
				this.#nextId = sha256(this.#nextId)
				// use the first 4 bytes (32 bits) of the hash, normalized to [0,1]
				const view = new DataView(this.#nextId.buffer, this.#nextId.byteOffset, 4)
				return view.getUint32(0, false) / 0xFFFFFFFF
			},
		}
	}

	public close() {}

	public get actionNames() {
		return Object.keys(this.actions)
	}

	private get context() {
		assert(this.#context !== null, "expected this.#context !== null")
		return this.#context
	}

	private get thisValue() {
		assert(this.#thisValue !== null, "expected this.#thisValue !== null")
		return this.#thisValue
	}

	protected async execute(exec: ExecutionContext): Promise<void | any> {
		const {
			did,
			name,
			args,
			context: { blockhash, timestamp },
		} = exec.message.payload

		const action = this.actions[name]
		if (action === undefined) {
			throw new Error(`invalid action name: ${name}`)
		}

		const thisValue: ActionContext<DeriveModelTypes<ModelsT>> = {
			db: this.#db,
			id: exec.id,
			publicKey: exec.signature.publicKey,
			did: did,
			address: exec.address,
			blockhash: blockhash ?? null,
			timestamp: timestamp,
		}

		try {
			this.#txnId = 0
			this.#nextId = encodeId(exec.id)
			this.#context = exec
			this.#thisValue = thisValue

			const result = await action.apply(thisValue, Array.isArray(args) ? args : [args])
			await this.#queue.onIdle()

			return result
		} catch (err) {
			trimActionStacktrace(err)
			throw err
		} finally {
			this.#txnId = 0
			this.#nextId = null
			this.#context = null
			this.#thisValue = null
		}
	}
}

// Remove canvas internal frames from the stack, then rebuild and return the error
function trimActionStacktrace(err: unknown): void {
	if (!(err instanceof Error) || typeof err.stack !== "string") {
		return
	}

	const stack = err.stack.split("\n")
	while (stack.length > 2) {
		const frame = stack[stack.length - 1]
		if (
			frame.includes("AbstractRuntime.js") ||
			frame.includes("AbstractGossipLog.js") ||
			frame.includes("FunctionRuntime.js") ||
			frame.includes("@canvas-js_okra-memory.js")
		) {
			stack.pop()
		} else {
			break
		}
	}
	err.stack = stack.join("\n")
}
