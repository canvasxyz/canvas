import PQueue from "p-queue"

import type { SignerCache } from "@canvas-js/interfaces"
import { ModelSchema, DeriveModelTypes } from "@canvas-js/modeldb"
import { assert, mapValues } from "@canvas-js/utils"

import { ActionContext, ActionImplementation, Contract, ModelAPI } from "../types.js"
import { ExecutionContext } from "../ExecutionContext.js"
import { AbstractRuntime } from "./AbstractRuntime.js"

export class FunctionRuntime<ModelsT extends ModelSchema> extends AbstractRuntime {
	public static async init<ModelsT extends ModelSchema>(
		topic: string,
		signers: SignerCache,
		contract: Contract<ModelsT>,
	): Promise<FunctionRuntime<ModelsT>> {
		assert(contract.actions !== undefined, "contract initialized without actions")
		assert(contract.models !== undefined, "contract initialized without models")
		assert(
			Object.keys(contract.models).every((key) => !key.startsWith("$")),
			"contract model names cannot start with '$'",
		)

		return new FunctionRuntime(topic, signers, contract)
	}

	public readonly contract: string
	public readonly actions: Record<string, ActionImplementation<ModelsT, any>>

	#context: ExecutionContext | null = null
	#transaction: boolean = false
	#thisValue: ActionContext<DeriveModelTypes<ModelsT>> | null = null
	#queue = new PQueue({ concurrency: 1 })
	#db: ModelAPI<DeriveModelTypes<ModelsT>>

	constructor(public readonly topic: string, public readonly signers: SignerCache, contract: Contract<ModelsT>) {
		super(contract.models)
		this.contract = [
			`export const models = ${JSON.stringify(contract.models, null, "  ")};`,
			`export const actions = {\n${Object.entries(contract.actions)
				.map(([name, action]) => `${name}: ${action}`)
				.join(", \n")}};`,
		].join("\n")
		this.actions = contract.actions

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
			delete: (model, key) => this.#queue.add(() => this.context.deleteModelValue(model, key, this.#transaction)),

			transaction: async (callback) => {
				try {
					this.#transaction = true
					return await callback.apply(this.thisValue, [])
				} finally {
					this.#transaction = false
				}
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

	protected async execute(ex: ExecutionContext): Promise<void | any> {
		const {
			did,
			name,
			args,
			context: { blockhash, timestamp },
		} = ex.message.payload

		const action = this.actions[name]
		if (action === undefined) {
			throw new Error(`invalid action name: ${name}`)
		}

		const thisValue: ActionContext<DeriveModelTypes<ModelsT>> = {
			db: this.#db,
			id: ex.id,
			publicKey: ex.signature.publicKey,
			did: did,
			address: ex.address,
			blockhash: blockhash ?? null,
			timestamp: timestamp,
		}

		try {
			this.#context = ex
			this.#thisValue = thisValue

			const result = await action.apply(thisValue, Array.isArray(args) ? [this.#db, ...args] : [this.#db, args])
			await this.#queue.onIdle()

			return result
		} catch (err) {
			trimActionStacktrace(err)
			console.log("Error inside canvas action:", err)
			throw err
		} finally {
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
