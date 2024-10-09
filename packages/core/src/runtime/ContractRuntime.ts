import { QuickJSHandle } from "quickjs-emscripten"
import { TypeTransformerFunction, create } from "@ipld/schema/typed.js"
import { fromDSL } from "@ipld/schema/from-dsl.js"
import type pg from "pg"

import type { SignerCache } from "@canvas-js/interfaces"
import { AbstractModelDB, ModelValue, ModelSchema, validateModelValue, mergeModelValues } from "@canvas-js/modeldb"
import { VM } from "@canvas-js/vm"
import { assert, mapEntries, mapValues, JSValue } from "@canvas-js/utils"

import target from "#target"

import { AbstractRuntime, ExecutionContext } from "./AbstractRuntime.js"
import { sha256 } from "@noble/hashes/sha256"
import { bytesToHex } from "@noble/hashes/utils"

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

		const argsTransformers: Record<
			string,
			{ toTyped: TypeTransformerFunction; toRepresentation: TypeTransformerFunction }
		> = {}

		const actions = mapEntries(actionsUnwrap, ([actionName, handle]) => {
			if (vm.context.typeof(handle) === "function") {
				argsTransformers[actionName] = { toTyped: (x: any) => x, toRepresentation: (x: any) => x }
				return handle.consume(vm.cache)
			}

			const { apply, argsType } = handle.consume(vm.unwrapObject)
			assert(vm.context.typeof(apply) === "function", "expected action[name].apply to be a function")

			if (argsType !== undefined) {
				const { schema, name } = argsType.consume(vm.unwrapObject)
				argsTransformers[actionName] = create(
					fromDSL(schema.consume(vm.context.getString)),
					name.consume(vm.context.getString),
				)
			} else {
				argsTransformers[actionName] = { toTyped: (x: any) => x, toRepresentation: (x: any) => x }
			}

			return apply.consume(vm.cache)
		})

		// TODO: Validate that models satisfies ModelSchema
		const mergeHandles: Record<string, QuickJSHandle> = {}

		const modelSchema = mapEntries(modelsUnwrap, ([name, handle]) => {
			// Extract the $merge handle, which is not included in `fields`
			// because vm.context.dump only passes on JSON-able fields.
			const mergeHandle = vm.unwrapObject(handle)["$merge"]
			const fields = handle.consume(vm.context.dump)
			if (mergeHandle) {
				mergeHandles[name] = mergeHandle
				fields.$merge = (merge1: JSValue, merge2: JSValue) => {
					const merge1Handle = vm.wrapValue(merge1)
					const merge2Handle = vm.wrapValue(merge2)
					const callResult = vm.context.callFunction(mergeHandle, vm.context.null, merge1Handle, merge2Handle)
					merge1Handle.dispose()
					merge2Handle.dispose()
					if (callResult.error) {
						callResult.error.dispose() // do we need this?
						throw new Error(`error in ${name}.$merge`)
					}
					return callResult.value.consume(vm.context.dump)
				}
			}
			return fields
		}) as ModelSchema

		const cleanupSetupHandles = () => {
			for (const handle of Object.values(mergeHandles)) {
				handle.dispose()
			}
		}

		const schema = AbstractRuntime.getModelSchema(modelSchema)
		return new ContractRuntime(topic, signers, schema, vm, actions, argsTransformers, cleanupSetupHandles)
	}

	readonly #databaseAPI: QuickJSHandle

	#context: ExecutionContext | null = null

	constructor(
		public readonly topic: string,
		public readonly signers: SignerCache,
		public readonly schema: ModelSchema,
		public readonly vm: VM,
		public readonly actions: Record<string, QuickJSHandle>,
		public readonly argsTransformers: Record<
			string,
			{ toTyped: TypeTransformerFunction; toRepresentation: TypeTransformerFunction }
		>,
		private disposeSetupHandles: () => void
	) {
		super()
		this.#databaseAPI = vm
			.wrapObject({
				get: vm.wrapFunction((model, key) => {
					assert(this.#context !== null, "expected this.#context !== null")
					assert(typeof model === "string", 'expected typeof model === "string"')
					assert(typeof key === "string", 'expected typeof key === "string"')
					return this.getModelValue(this.#context, model, key)
				}),
				set: vm.context.newFunction("set", (modelHandle, valueHandle) => {
					assert(this.#context !== null, "expected this.#modelEntries !== null")
					const model = vm.context.getString(modelHandle)
					assert(this.db.models[model] !== undefined, "model not found")
					const value = this.vm.unwrapValue(valueHandle) as ModelValue
					validateModelValue(this.db.models[model], value)
					const { primaryKey } = this.db.models[model]
					const key = value[primaryKey] as string
					assert(typeof key === "string", "expected value[primaryKey] to be a string")
					this.#context.modelEntries[model][key] = value
				}),
				merge: vm.context.newFunction("merge", (modelHandle, valueHandle) => {
					assert(this.#context !== null, "expected this.#modelEntries !== null")
					const model = vm.context.getString(modelHandle)
					assert(this.db.models[model] !== undefined, "model not found")
					const { primaryKey } = this.db.models[model]
					const value = this.vm.unwrapValue(valueHandle) as ModelValue
					const key = value[primaryKey] as string
					assert(typeof key === "string", "expected value[primaryKey] to be a string")
					const promise = vm.context.newPromise()

					// TODO: Ensure concurrent merges into the same value don't create a race condition
					// if the user doesn't call db.merge() with await.
					this.getModelValue(this.#context, model, key)
						.then((previousValue) => {
							const mergedValue = mergeModelValues(value, previousValue ?? {})
							validateModelValue(this.db.models[model], mergedValue)
							assert(this.#context !== null)
							this.#context.modelEntries[model][key] = mergedValue
							promise.resolve()
						})
						.catch((err) => {
							promise.reject()
						})

					promise.settled.then(vm.runtime.executePendingJobs)
					return promise.handle
				}),

				delete: vm.context.newFunction("delete", (modelHandle, keyHandle) => {
					assert(this.#context !== null, "expected this.#modelEntries !== null")
					const model = vm.context.getString(modelHandle)
					assert(this.db.models[model] !== undefined, "model not found")
					const key = vm.context.getString(keyHandle)
					this.#context.modelEntries[model][key] = null
				}),
			})
			.consume(vm.cache)
	}

	public async close() {
		try {
			await super.close()
		} finally {
			this.disposeSetupHandles()
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
		const argsTransformer = this.argsTransformers[name]

		if (actionHandle === undefined || argsTransformer === undefined) {
			throw new Error(`invalid action name: ${name}`)
		}

		const typedArgs = argsTransformer.toTyped(args)
		assert(typedArgs !== undefined, "action args did not validate the provided schema type")

		this.#context = context

		const argsHandle = this.vm.wrapValue(typedArgs)
		const ctxHandle = this.vm.wrapValue({
			id: context.id,
			publicKey,
			did,
			address,
			blockhash: blockhash ?? null,
			timestamp,
		})
		try {
			const result = await this.vm.callAsync(actionHandle, actionHandle, [this.#databaseAPI, argsHandle, ctxHandle])

			return result.consume((handle) => {
				if (this.vm.context.typeof(handle) === "undefined") {
					return undefined
				} else {
					return this.vm.unwrapValue(result)
				}
			})
		} finally {
			argsHandle.dispose()
			ctxHandle.dispose()
			this.#context = null
		}
	}
}
