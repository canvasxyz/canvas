import { QuickJSHandle } from "quickjs-emscripten"
import { TypeTransformerFunction, create } from "@ipld/schema/typed.js"
import { fromDSL } from "@ipld/schema/from-dsl.js"

import type { SessionSigner } from "@canvas-js/interfaces"

import { AbstractModelDB, Model, ModelValue, ModelsInit, validateModelValue } from "@canvas-js/modeldb"

import { VM } from "@canvas-js/vm"
import { getCID } from "@canvas-js/signed-cid"

import target from "#target"

import { assert, mapEntries } from "../utils.js"

import { AbstractRuntime, ExecutionContext } from "./AbstractRuntime.js"

export class ContractRuntime extends AbstractRuntime {
	public static async init(
		path: string | null,
		signers: SessionSigner[],
		contract: string,
		options: { runtimeMemoryLimit?: number; indexHistory?: boolean } = {},
	): Promise<ContractRuntime> {
		const { runtimeMemoryLimit, indexHistory = true } = options

		const cid = getCID(contract, { codec: "raw", digest: "blake3-128" })
		const uri = `canvas:${cid.toString()}`

		const vm = await VM.initialize({ runtimeMemoryLimit })

		const {
			topic: topicHandle,
			models: modelsHandle,
			actions: actionsHandle,
			...rest
		} = await vm.import(contract, { uri }).then((handle) => handle.consume(vm.unwrapObject))

		for (const [name, handle] of Object.entries(rest)) {
			console.warn(`extraneous export ${JSON.stringify(name)}`)
			handle.dispose()
		}

		assert(topicHandle !== undefined, "missing `topic` export")
		const topic = topicHandle.consume(vm.context.getString)

		assert(actionsHandle !== undefined, "missing `actions` export")

		const argsTransformers: Record<
			string,
			{ toTyped: TypeTransformerFunction; toRepresentation: TypeTransformerFunction }
		> = {}

		const actions = mapEntries(actionsHandle.consume(vm.unwrapObject), ([actionName, handle]) => {
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

		// TODO: validate that models satisfies ModelsInit
		assert(modelsHandle !== undefined, "missing `models` export")
		const modelsInit = modelsHandle.consume(vm.context.dump) as ModelsInit

		const db = await target.openDB({ path, topic }, AbstractRuntime.getModelSchema(modelsInit, { indexHistory }))
		return new ContractRuntime(topic, signers, db, vm, actions, argsTransformers, indexHistory)
	}

	readonly #databaseAPI: QuickJSHandle

	#context: ExecutionContext | null = null

	constructor(
		public readonly topic: string,
		public readonly signers: SessionSigner[],
		public readonly db: AbstractModelDB,
		public readonly vm: VM,
		public readonly actions: Record<string, QuickJSHandle>,
		public readonly argsTransformers: Record<
			string,
			{ toTyped: TypeTransformerFunction; toRepresentation: TypeTransformerFunction }
		>,
		indexHistory: boolean,
	) {
		super(indexHistory)
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
			this.vm.dispose()
		}
	}

	public get actionNames() {
		return Object.keys(this.actions)
	}

	protected async execute(context: ExecutionContext): Promise<void | any> {
		const { address, name, args, blockhash, timestamp } = context.message.payload

		const actionHandle = this.actions[name]
		const argsTransformer = this.argsTransformers[name]
		assert(actionHandle !== undefined && argsTransformer !== undefined, `invalid action name: ${name}`)

		const typedArgs = argsTransformer.toTyped(args)
		assert(typedArgs !== undefined, "action args did not validate the provided schema type")

		this.#context = context

		const argsHandle = this.vm.wrapValue(typedArgs)
		const ctxHandle = this.vm.wrapValue({ id: context.id, address, blockhash, timestamp })
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
