import PQueue from "p-queue"

import type { SignerCache } from "@canvas-js/interfaces"
import { DeriveModelTypes } from "@canvas-js/modeldb"
import { assert } from "@canvas-js/utils"
import { encodeId } from "@canvas-js/gossiplog"
import { bytesToHex } from "@noble/hashes/utils"
import { sha256 } from "@noble/hashes/sha256"

import { Contract as BaseContract } from "@canvas-js/core/contract"

import { ModelSchema, ModelAPI, ContractClass, ContractAction } from "../types.js"
import { ExecutionContext } from "../ExecutionContext.js"
import { AbstractRuntime } from "./AbstractRuntime.js"
import { ActionAPI } from "../index.js"

export class ClassFunctionRuntime extends AbstractRuntime {
	public static async init(
		topic: string,
		signers: SignerCache,
		contract: ContractClass<ModelSchema, BaseContract<ModelSchema>>,
	): Promise<ClassFunctionRuntime> {
		assert(contract.models !== undefined, "missing `static models` value in contract class")
		assert(
			Object.keys(contract.models).every((key) => !key.startsWith("$")),
			"contract model names cannot start with '$'",
		)

		const contractInstance = new contract(topic)
		const actionNames = Object.getOwnPropertyNames(contract.prototype).filter((name) => name !== "constructor")

		return new ClassFunctionRuntime(topic, signers, actionNames, contract.models, contractInstance)
	}

	#context: ExecutionContext | null = null
	#txnId = 0
	#nextId: Uint8Array | null = null
	#transaction = false
	#thisValue: BaseContract<ModelSchema> | null = null
	#queue = new PQueue({ concurrency: 1 })
	#db: ModelAPI

	#contract: BaseContract<ModelSchema>

	constructor(
		public readonly topic: string,
		public readonly signers: SignerCache,
		public readonly actionNames: string[],
		models: ModelSchema,
		contractInstance: BaseContract<ModelSchema>,
	) {
		super(models)

		this.#contract = contractInstance
		this.#db = {
			get: async <T extends keyof DeriveModelTypes<ModelSchema> & string>(model: T, key: string) => {
				const result = await this.#queue.add(() => this.context.getModelValue(model, key, this.#transaction))
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
					this.#transaction = false
				}
			},

			id: () => {
				if (this.#nextId === null) throw new Error("expected this.#nextId !== null")
				this.#nextId = sha256(this.#nextId)
				return bytesToHex(this.#nextId.slice(0, 16))
			},
		}
	}

	public close() {}

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

		const { [name]: actionAPI } = this.#contract as unknown as Record<string, ActionAPI>
		if (actionAPI === undefined) {
			throw new Error(`invalid action name: ${name}`)
		}

		const thisValue = {
			db: this.#db,
			id: exec.id,
			publicKey: exec.signature.publicKey,
			did: did,
			address: exec.address,
			blockhash: blockhash ?? null,
			timestamp: timestamp,
			topic: this.topic,
		} as BaseContract<ModelSchema>

		try {
			this.#txnId = 0
			this.#nextId = encodeId(exec.id)
			this.#context = exec
			this.#thisValue = thisValue

			const result = await actionAPI.apply(thisValue, Array.isArray(args) ? args : [args])
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
