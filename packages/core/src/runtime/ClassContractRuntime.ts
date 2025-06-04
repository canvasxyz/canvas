import { QuickJSHandle } from "quickjs-emscripten"

import { bytesToHex } from "@noble/hashes/utils"
import { sha256 } from "@noble/hashes/sha256"
import { assert } from "@canvas-js/utils"

import type { SignerCache } from "@canvas-js/interfaces"
import { ModelValue } from "@canvas-js/modeldb"
import { VM } from "@canvas-js/vm"
import { encodeId } from "@canvas-js/gossiplog"

import { ModelSchema } from "../types.js"
import { ExecutionContext } from "../ExecutionContext.js"
import { AbstractRuntime } from "./AbstractRuntime.js"

export class ClassContractRuntime extends AbstractRuntime {
	public static async init(
		topic: string,
		signers: SignerCache,
		contract: string,
		options: { runtimeMemoryLimit?: number } = {},
	): Promise<ClassContractRuntime> {
		const { runtimeMemoryLimit } = options

		const vm = await VM.initialize({ runtimeMemoryLimit })

		const contractURI = VM.getFileURI(contract)
		vm.runtime.setModuleLoader((moduleName, context) => {
			if (moduleName === "@canvas-js/core/contract") {
				return `export class Contract { constructor(topic) { this.topic = topic } }`
			} else if (moduleName === contractURI) {
				return contract
			} else {
				return { error: new Error(`module "${moduleName}" not found`) }
			}
		})

		using exportsHandle = vm.import(`
		  import Contract from "${contractURI}"
			const createContract = (...args) => new Contract(...args)
			export { Contract, createContract }
		`)

		using contractClassHandle = vm.context.getProp(exportsHandle, "Contract")
		using createContractHandle = vm.context.getProp(exportsHandle, "createContract")

		assert(vm.isClass(contractClassHandle), "invalid contract - expected vm.isClass(contractClassHandle)")
		assert(
			vm.context.typeof(createContractHandle),
			"function",
			"internal error - expected vm.context.typeof(createContractHandle)",
		)

		using contractPrototypeHandle = vm.context.getProp(contractClassHandle, "prototype")
		const actionNames = vm
			.call("Object.getOwnPropertyNames", vm.context.null, [contractPrototypeHandle])
			.consume((handle) => vm.unwrapArray(handle))
			.map((handle) => handle.consume((handle) => vm.context.getString(handle)))
			.filter((name) => name !== "constructor")

		using topicHandle = vm.wrapValue(topic)
		using contractHandle = vm.call(createContractHandle, vm.context.null, [topicHandle])
		using instanceTopicHandle = vm.context.getProp(contractHandle, "topic")
		const instanceTopic = vm.context.getString(instanceTopicHandle)

		using modelsHandle = vm.context.getProp(contractClassHandle, "models")
		assert(vm.context.typeof(modelsHandle) === "object", "invalid contract class - expected static models object")

		const models = vm.unwrapValue(modelsHandle) as ModelSchema
		assert(
			Object.keys(models).every((key) => !key.startsWith("$")),
			"contract model names cannot start with '$'",
		)

		const actionHandles = Object.fromEntries(
			actionNames.map((actionName) => [
				actionName,
				vm.context.getProp(contractPrototypeHandle, actionName).consume(vm.cache),
			]),
		)

		return new ClassContractRuntime(instanceTopic, signers, vm, contract, actionHandles, models)
	}

	readonly #databaseAPI: QuickJSHandle

	#context: ExecutionContext | null = null
	#thisHandle: QuickJSHandle | null = null
	#transaction = false
	#txnId = 0

	constructor(
		public readonly topic: string,
		public readonly signers: SignerCache,
		public readonly vm: VM,
		public readonly contract: string,
		public readonly actionHandles: Record<string, QuickJSHandle>,
		modelSchema: ModelSchema,
	) {
		super(modelSchema)

		this.actionHandles = actionHandles
		this.contract = contract

		const databaseAPI = vm.wrapObject({
			get: vm.wrapFunction(async (model, key) => {
				assert(typeof model === "string", 'expected typeof model === "string"')
				assert(typeof key === "string", 'expected typeof key === "string"')
				return await this.context.getModelValue(model, key, this.#transaction)
			}),

			set: vm.wrapFunction(async (model, value) => {
				assert(typeof model === "string", 'expected typeof model === "string"')
				await this.context.setModelValue(model, value as ModelValue, this.#transaction)
			}),

			update: vm.wrapFunction(async (model, value) => {
				assert(typeof model === "string", 'expected typeof model === "string"')
				await this.context.updateModelValue(model, value as ModelValue, this.#transaction)
			}),

			merge: vm.wrapFunction(async (model, value) => {
				assert(typeof model === "string", 'expected typeof model === "string"')
				await this.context.mergeModelValue(model, value as ModelValue, this.#transaction)
			}),

			create: vm.wrapFunction(async (model, value) => {
				assert(typeof model === "string", 'expected typeof model === "string"')
				await this.context.createModelValue(model, value as ModelValue, this.#transaction)
			}),

			delete: vm.wrapFunction(async (model, key) => {
				assert(typeof model === "string", 'expected typeof model === "string"')
				assert(typeof key === "string", 'expected typeof key === "string"')
				await this.context.deleteModelValue(model, key, this.#transaction)
			}),

			transaction: vm.context.newFunction("transaction", (callbackHandle) => {
				const promise = vm.context.newPromise()
				if (this.#txnId === 0) {
					this.#txnId += 1
					this.#transaction = true
					this.vm
						.callAsync(callbackHandle, this.thisHandle, [])
						.then(promise.resolve, (err) => promise.reject(vm.wrapError(err)))
						.finally(() => void (this.#transaction = false))
				} else {
					promise.reject(vm.wrapError(new Error("transaction(...) can only be used once per action")))
				}

				promise.settled.then(vm.runtime.executePendingJobs)
				return promise.handle
			}),

			id: vm.context.newFunction("idgen", () => {
				const prng = this.context.prng
				const hi = prng.getUint64().toString(16).padStart(16, "0")
				const lo = prng.getUint64().toString(16).padStart(16, "0")
				return vm.context.newString(hi + lo)
			}),

			random: vm.context.newFunction("random", () => {
				const prng = this.context.prng
				return vm.context.newNumber(prng.getFloat())
			}),
		})

		this.#databaseAPI = databaseAPI.consume(vm.cache)
	}

	public close() {
		this.vm.dispose()
	}

	public getContract() {
		return this.contract
	}

	public get actionNames() {
		return Object.keys(this.actionHandles)
	}

	private get context() {
		assert(this.#context !== null, "expected this.#context !== null")
		return this.#context
	}

	private get thisHandle() {
		assert(this.#thisHandle !== null, "expected this.#thisHandle !== null")
		return this.#thisHandle
	}

	protected async execute(exec: ExecutionContext): Promise<void | any> {
		const {
			name,
			args,
			context: { blockhash, timestamp },
		} = exec.message.payload

		const actionHandle = this.actionHandles[name]
		if (actionHandle === undefined) {
			throw new Error(`invalid action name: ${name}`)
		}

		const thisHandle = this.vm.wrapValue({
			id: exec.id,
			publicKey: exec.publicKey,
			did: exec.did,
			address: exec.address,
			blockhash: blockhash ?? null,
			timestamp,
		})

		this.vm.context.setProp(thisHandle, "db", this.#databaseAPI)

		const argHandles = Array.isArray(args) ? args.map(this.vm.wrapValue) : [this.vm.wrapValue(args)]

		try {
			this.#txnId = 0
			this.#context = exec
			this.#thisHandle = thisHandle

			const result = await this.vm.callAsync(actionHandle, thisHandle, argHandles)
			return result.consume((handle) => this.vm.unwrapValue(handle))
		} finally {
			argHandles.forEach((handle: QuickJSHandle) => handle.dispose())
			thisHandle.dispose()
			this.#txnId = 0
			this.#context = null
			this.#thisHandle = null
		}
	}
}
