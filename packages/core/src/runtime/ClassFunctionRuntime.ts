import PQueue from "p-queue"

import { assert, JSValue } from "@canvas-js/utils"

import type { SignerCache } from "@canvas-js/interfaces"
import { DeriveModelTypes } from "@canvas-js/modeldb"

import { Contract as BaseContract } from "@canvas-js/core/contract"

import { ModelSchema, ModelAPI, ContractClass } from "../types.js"
import { ExecutionContext } from "../ExecutionContext.js"
import { AbstractRuntime } from "./AbstractRuntime.js"
import { ActionAPI } from "../index.js"
import { extractRules, generateActionsFromRules } from "./rules.js"
import { bytesToHex, randomBytes } from "@noble/hashes/utils"

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

export class ClassFunctionRuntime extends AbstractRuntime {
	public static async init(
		contract: { models: ModelSchema; topic: string } | ContractClass<ModelSchema, BaseContract<ModelSchema>>,
		args: JSValue[],
		signers: SignerCache,
	): Promise<ClassFunctionRuntime> {
		assert(contract.models !== undefined, "missing `static models` value in contract class")

		assert(
			Object.keys(contract.models).every((key) => !key.startsWith("$")),
			"contract model names cannot start with '$'",
		)

		let contractInstance: BaseContract<ModelSchema>
		let actionNames: string[]
		if (isContractClass(contract)) {
			assert(
				Object.values(contract.models).every((model) => model.$rules === undefined),
				"class contracts cannot have model $rules",
			)

			contractInstance = new contract(args)
			actionNames = Object.getOwnPropertyNames(contract.prototype).filter((name) => name !== "constructor")
		} else {
			for (const [name, model] of Object.entries(contract.models)) {
				if (model.$rules === undefined) {
					throw new Error(`missing $rules from model "${name}"`)
				}
			}

			contractInstance = new BaseContract(args)
			actionNames = Object.keys(contract.models).flatMap((name) => [
				`${name}/create`,
				`${name}/update`,
				`${name}/delete`,
			])

			const { rules, baseModels } = extractRules(contract.models)
			const actionEntries = Object.entries(generateActionsFromRules(rules, baseModels)).flatMap(([name, actions]) => [
				[`${name}/create`, actions.create],
				[`${name}/update`, actions.update],
				[`${name}/delete`, actions.delete],
			])

			Object.assign(contractInstance, Object.fromEntries(actionEntries))
		}

		const topic =
			isContractClass(contract) && contract.name && contract.name !== "default"
				? `${contract.topic}.${contract.name}`
				: contract.topic

		return new ClassFunctionRuntime(topic, signers, actionNames, contract.models, contractInstance)
	}

	#context: ExecutionContext | null = null
	#txnId = 0
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
					await this.#queue.onIdle()
					this.#transaction = false
				}
			},

			id: () => {
				const prng = this.context.prng
				const hi = prng.getUint64().toString(16).padStart(16, "0")
				const lo = prng.getUint64().toString(16).padStart(16, "0")
				return hi + lo
			},

			random: () => this.context.prng.getFloat(),
		}
	}

	public close() {}

	public getContract() {
		return null
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
			topic: exec.messageLog.topic,
		} as BaseContract<ModelSchema>

		try {
			this.#txnId = 0
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
