import { QuickJSHandle } from "quickjs-emscripten"

import type { SignerCache } from "@canvas-js/interfaces"
import { ModelValue, ModelSchema, validateModelValue } from "@canvas-js/modeldb"
import { VM } from "@canvas-js/vm"
import { assert, mapValues } from "@canvas-js/utils"

import { AbstractRuntime, ExecutionContext } from "./AbstractRuntime.js"

export class ContractRuntime extends AbstractRuntime {
	public static async init(
		topic: string,
		signers: SignerCache,
		contract: string,
		options: { runtimeMemoryLimit?: number } = {},
	): Promise<ContractRuntime> {
		const { runtimeMemoryLimit } = options

		const vm = await VM.initialize({ runtimeMemoryLimit })

		const {
			contract: contractHandle,
			models: modelsHandle,
			actions: actionsHandle,
			...rest
		} = vm.import(contract).consume(vm.unwrapObject)

		for (const [name, handle] of Object.entries(rest)) {
			console.warn(`extraneous export ${JSON.stringify(name)}`)
			handle.dispose()
		}

		assert(
			contractHandle !== undefined || (actionsHandle !== undefined && modelsHandle !== undefined),
			"must export `contract` or `models` and `actions`",
		)

		// intermediate unwrapped objects Record<string, QuickJSHandle>
		const contractUnwrap = contractHandle?.consume(vm.unwrapObject)
		const actionsUnwrap = (contractHandle ? contractUnwrap.actions : actionsHandle).consume(vm.unwrapObject)
		const modelsUnwrap = (contractHandle ? contractUnwrap.models : modelsHandle).consume(vm.unwrapObject)

		const actions = mapValues(actionsUnwrap, (handle) => {
			assert(vm.context.typeof(handle) === "function", "expected action handle to be a function")
			return handle.consume(vm.cache)
		})

		const modelSchema = mapValues(modelsUnwrap, (handle) => handle.consume(vm.context.dump)) as ModelSchema

		const schema = AbstractRuntime.getModelSchema(modelSchema)
		return new ContractRuntime(topic, signers, schema, vm, actions)
	}

	readonly #databaseAPI: QuickJSHandle

	#context: ExecutionContext | null = null

	constructor(
		public readonly topic: string,
		public readonly signers: SignerCache,
		public readonly schema: ModelSchema,
		public readonly vm: VM,
		public readonly actions: Record<string, QuickJSHandle>,
	) {
		super()
		this.#databaseAPI = vm
			.wrapObject({
				get: vm.wrapFunction(async (model, key) => {
					assert(this.#context !== null, "expected this.#context !== null")
					assert(typeof model === "string", 'expected typeof model === "string"')
					assert(typeof key === "string", 'expected typeof key === "string"')
					return await this.getModelValue(this.#context, model, key)
				}),
				set: vm.wrapFunction(async (model, value) => {
					assert(this.#context !== null, "expected this.#context !== null")
					assert(typeof model === "string", 'expected typeof model === "string"')
					assert(typeof value === "object", 'expected typeof value === "object"')
					await this.setModelValue(this.#context, model, value as ModelValue)
				}),
				create: vm.wrapFunction(async (model, value) => {
					assert(this.#context !== null, "expected this.#context !== null")
					assert(typeof model === "string", 'expected typeof model === "string"')
					assert(typeof value === "object", 'expected typeof value === "object"')
					await this.setModelValue(this.#context, model, value as ModelValue)
				}),
				update: vm.wrapFunction(async (model, value) => {
					assert(this.#context !== null, "expected this.#context !== null")
					assert(typeof model === "string", 'expected typeof model === "string"')
					assert(typeof value === "object", 'expected typeof value === "object"')
					await this.updateModelValue(this.#context, model, value as ModelValue)
				}),
				merge: vm.wrapFunction(async (model, value) => {
					assert(this.#context !== null, "expected this.#context !== null")
					assert(typeof model === "string", 'expected typeof model === "string"')
					assert(typeof value === "object", 'expected typeof value === "object"')
					await this.mergeModelValue(this.#context, model, value as ModelValue)
				}),
				delete: vm.wrapFunction(async (model, key) => {
					assert(this.#context !== null, "expected this.#context !== null")
					assert(typeof model === "string", 'expected typeof model === "string"')
					assert(typeof key === "string", 'expected typeof key === "string"')
					await this.deleteModelValue(this.#context, model, key)
				}),
			})
			.consume(vm.cache)
	}

	public async close() {
		try {
			await super.close()
		} finally {
			this.vm.dispose()
		}
	}

	public get actionNames() {
		return Object.keys(this.actions)
	}

	protected async execute(context: ExecutionContext): Promise<void | any> {
		const { publicKey } = context.signature
		const { address } = context
		const {
			did,
			name,
			args,
			context: { blockhash, timestamp },
		} = context.message.payload

		const actionHandle = this.actions[name]

		if (actionHandle === undefined) {
			throw new Error(`invalid action name: ${name}`)
		}

		this.#context = context

		const ctxHandle = this.vm.wrapValue({
			id: context.id,
			publicKey,
			did,
			address,
			blockhash: blockhash ?? null,
			timestamp,
		})
		const argHandles = args.map(this.vm.wrapValue)
		try {
			const result = await this.vm.callAsync(actionHandle, ctxHandle, [this.#databaseAPI, ...argHandles])

			return result.consume((handle) => {
				if (this.vm.context.typeof(handle) === "undefined") {
					return undefined
				} else {
					return this.vm.unwrapValue(result)
				}
			})
		} finally {
			argHandles.map((handle: QuickJSHandle) => handle.dispose())
			ctxHandle.dispose()
			this.#context = null
		}
	}
}
