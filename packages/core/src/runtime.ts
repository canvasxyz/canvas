import { QuickJSHandle } from "quickjs-emscripten"

import type { Action } from "@canvas-js/interfaces"
import { JSValue, VM } from "@canvas-js/vm"
import {
	AbstractModelDB,
	Effect,
	Model,
	ModelValue,
	ModelsInit,
	Property,
	PropertyValue,
	Resolver,
	lessThan,
	validateModelValue,
} from "@canvas-js/modeldb"

import { PlatformTarget } from "./targets/interface.js"
import { Awaitable, assert, mapValues, signalInvalidType, mapEntries } from "./utils.js"
import { getCID } from "@canvas-js/signed-cid"

export interface Runtime {
	topic: string
	db: AbstractModelDB
	actionNames: string[]
	close(): Awaitable<void>
	execute(id: string, action: Action): Awaitable<{ effects: Effect[]; result: void | JSValue }>
}

export function getRuntime(
	target: PlatformTarget,
	contract: string | { topic: string; models: ModelsInit; actions: Record<string, ActionImplementation> },
	options: { runtimeMemoryLimit?: number } = {},
): Promise<Runtime> {
	if (typeof contract === "string") {
		return ContractRuntime.init(target, contract, options)
	} else {
		return FunctionRuntime.init(target, contract)
	}
}

export type ActionImplementation = (
	db: Record<string, ModelAPI>,
	args: JSValue,
	context: ActionContext,
) => Awaitable<void | JSValue>

export type GenericActionImplementation = (
	db: Record<string, ModelAPI>,
	args: any,
	context: ActionContext,
) => Awaitable<void | JSValue>

export type ModelAPI = {
	get: (key: string) => Promise<ModelValue | null>
	set: (key: string, value: ModelValue) => Promise<void>
	delete: (key: string) => Promise<void>
}

export type ActionContext = { id: string; chain: string; address: string; blockhash: string | null; timestamp: number }

const resolver: Resolver = { lessThan: (a, b) => lessThan(a.version, b.version) }

class ContractRuntime implements Runtime {
	public static async init(target: PlatformTarget, contract: string, options: { runtimeMemoryLimit?: number } = {}) {
		const cid = getCID(contract, { codec: "raw", digest: "blake3-128" })
		const uri = `canvas:${cid.toString()}`

		const vm = await VM.initialize(options)

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

		const topic = topicHandle?.consume(vm.context.getString) ?? cid.toString()

		assert(actionsHandle !== undefined, "missing `actions` export")
		const actionHandles = mapValues(actionsHandle.consume(vm.unwrapObject), (handle) => {
			assert(vm.context.typeof(handle) === "function", "expected action[name] to be a function")
			return handle.consume(vm.cache)
		})

		// TODO: validate that models satisfies ModelsInit
		assert(modelsHandle !== undefined, "missing `models` export")
		const models = modelsHandle.consume(vm.context.dump) as ModelsInit

		const db = await target.openDB("db", models, { resolver })
		return new ContractRuntime(topic, db, vm, actionHandles)
	}

	private readonly databaseAPI: QuickJSHandle

	#effects: Effect[] | null = null

	constructor(
		public readonly topic: string,
		public readonly db: AbstractModelDB,
		private readonly vm: VM,
		private readonly actionHandles: Record<string, QuickJSHandle>,
	) {
		this.databaseAPI = vm
			.wrapObject(Object.fromEntries(db.config.models.map((model) => [model.name, this.createAPI(model)])))
			.consume(vm.cache)
	}

	public close() {
		this.vm.dispose()
	}

	public get actionNames() {
		return Object.keys(this.actionHandles)
	}

	public async execute(id: string, action: Action): Promise<{ effects: Effect[]; result: void | JSValue }> {
		const { chain, address, name, args, blockhash, timestamp } = action

		const actionHandle = this.actionHandles[name]
		assert(actionHandle !== undefined, `invalid action name: ${name}`)

		this.#effects = []
		const argsHandle = this.vm.wrapValue(args)
		const ctxHandle = this.vm.wrapValue({ id, chain, address, blockhash, timestamp })
		try {
			const result = await this.vm.callAsync(actionHandle, actionHandle, [this.databaseAPI, argsHandle, ctxHandle])

			return {
				effects: this.#effects,
				result: result.consume((handle) => {
					if (this.vm.context.typeof(handle) === "undefined") {
						return undefined
					} else {
						return this.vm.unwrapValue(result)
					}
				}),
			}
		} finally {
			argsHandle.dispose()
			ctxHandle.dispose()
			this.#effects = null
		}
	}

	private createAPI(model: Model): QuickJSHandle {
		return this.vm.wrapObject({
			get: this.vm.context.newFunction(`db.${model.name}.get`, (keyHandle) => {
				assert(this.#effects !== null, "internal error")
				throw new Error("not implemented")
			}),
			set: this.vm.context.newFunction(`db.${model.name}.set`, (keyHandle, valueHandle) => {
				assert(this.#effects !== null, "internal error")
				const key = this.vm.context.getString(keyHandle)
				const value = this.unwrapModelValue(model, valueHandle)
				this.#effects.push({ model: model.name, operation: "set", key, value })
			}),
			delete: this.vm.context.newFunction(`db.${model.name}.delete`, (keyHandle) => {
				assert(this.#effects !== null, "internal error")
				const key = this.vm.context.getString(keyHandle)
				this.#effects.push({ model: model.name, operation: "delete", key })
			}),
		})
	}

	private unwrapModelValue(model: Model, handle: QuickJSHandle): ModelValue {
		const values = model.properties.map<[string, PropertyValue]>((property) => {
			const propertyHandle = this.vm.context.getProp(handle, property.name)
			const propertyValue = propertyHandle.consume((handle) => this.unwrapPropertyValue(property, handle))
			return [property.name, propertyValue]
		})

		return Object.fromEntries(values)
	}

	private unwrapPropertyValue(property: Property, handle: QuickJSHandle): PropertyValue {
		if (property.kind === "primitive") {
			if (property.type === "integer") {
				const value = this.vm.context.getNumber(handle)
				assert(Number.isSafeInteger(value), "property value must be a safe integer")
				return value
			} else if (property.type === "float") {
				return this.vm.context.getNumber(handle)
			} else if (property.type === "string") {
				return this.vm.context.getString(handle)
			} else if (property.type === "bytes") {
				return this.vm.getUint8Array(handle)
			} else {
				signalInvalidType(property.type)
			}
		} else if (property.kind === "reference") {
			if (this.vm.is(handle, this.vm.context.null)) {
				return null
			} else {
				return this.vm.context.getString(handle)
			}
		} else if (property.kind === "relation") {
			// TODO: this might need to be consumed...
			// return this.vm.unwrapArray(handle, (elementHandle) => elementHandle.consume(this.vm.context.getString))
			return this.vm.unwrapArray(handle, (elementHandle) => this.vm.context.getString(elementHandle))
		} else {
			signalInvalidType(property)
		}
	}
}

class FunctionRuntime implements Runtime {
	public static async init(
		target: PlatformTarget,
		contract: { topic: string; models: ModelsInit; actions: Record<string, ActionImplementation> },
	): Promise<Runtime> {
		const db = await target.openDB("models", contract.models, { resolver })
		return new FunctionRuntime(contract.topic, db, contract.actions)
	}

	constructor(
		public readonly topic: string,
		public readonly db: AbstractModelDB,
		public readonly actions: Record<string, ActionImplementation>,
	) {}

	public close() {}

	public get actionNames() {
		return Object.keys(this.actions)
	}

	public async execute(id: string, action: Action): Promise<{ effects: Effect[]; result: JSValue | void }> {
		const { chain, address, name, args, blockhash, timestamp } = action
		assert(this.actions[name] !== undefined, `invalid action name: ${name}`)

		const effects: Effect[] = []

		const api = mapValues(this.db.models, (model) => ({
			get: async (key: string) => {
				throw new Error("not implemented")
			},
			set: async (key: string, value: ModelValue) => {
				validateModelValue(model, value)
				effects.push({ model: model.name, operation: "set", key, value })
			},
			delete: async (key: string) => {
				effects.push({ model: model.name, operation: "delete", key })
			},
		}))

		const result = await this.actions[name](api, args, { id, chain, address, blockhash, timestamp })

		return { effects, result }
	}
}
