import { QuickJSHandle } from "quickjs-emscripten"

import type { Action, SessionSigner } from "@canvas-js/interfaces"
import { JSValue, VM } from "@canvas-js/vm"
import { AbstractModelDB, Model, ModelValue, ModelsInit, Property, PropertyValue } from "@canvas-js/modeldb"
import { getCID } from "@canvas-js/signed-cid"

import { PlatformTarget } from "../targets/interface.js"
import { assert, mapValues, signalInvalidType } from "../utils.js"

import { AbstractRuntime } from "./AbstractRuntime.js"

export class ContractRuntime extends AbstractRuntime {
	public static async init(
		target: PlatformTarget,
		signers: SessionSigner[],
		contract: string,
		options: { runtimeMemoryLimit?: number; indexHistory?: boolean } = {}
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

		const topic = topicHandle?.consume(vm.context.getString) ?? cid.toString()

		assert(actionsHandle !== undefined, "missing `actions` export")
		const actionHandles = mapValues(actionsHandle.consume(vm.unwrapObject), (handle) => {
			assert(vm.context.typeof(handle) === "function", "expected action[name] to be a function")
			return handle.consume(vm.cache)
		})

		// TODO: validate that models satisfies ModelsInit
		assert(modelsHandle !== undefined, "missing `models` export")
		const modelsInit = modelsHandle.consume(vm.context.dump) as ModelsInit

		if (indexHistory) {
			const db = await target.openDB("db", {
				...modelsInit,
				...AbstractRuntime.sessionsModel,
				...AbstractRuntime.effectsModel,
			})

			return new ContractRuntime(signers, topic, db, vm, actionHandles, indexHistory)
		} else {
			const db = await target.openDB("db", {
				...modelsInit,
				...AbstractRuntime.sessionsModel,
				...AbstractRuntime.versionsModel,
			})

			return new ContractRuntime(signers, topic, db, vm, actionHandles, indexHistory)
		}
	}

	readonly #databaseAPI: QuickJSHandle

	#context: { id: string; modelEntries: Record<string, Record<string, ModelValue | null>> } | null = null

	constructor(
		public readonly signers: SessionSigner[],
		public readonly topic: string,
		public readonly db: AbstractModelDB,
		private readonly vm: VM,
		private readonly actionHandles: Record<string, QuickJSHandle>,
		indexHistory: boolean
	) {
		super(indexHistory)
		this.#databaseAPI = vm
			.wrapObject(Object.fromEntries(db.config.models.map((model) => [model.name, this.createAPI(model)])))
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
		return Object.keys(this.actionHandles)
	}

	protected async execute(
		modelEntries: Record<string, Record<string, ModelValue | null>>,
		id: string,
		action: Action
	): Promise<void | JSValue> {
		const { chain, address, name, args, blockhash, timestamp } = action

		const actionHandle = this.actionHandles[name]
		assert(actionHandle !== undefined, `invalid action name: ${name}`)

		this.#context = { id, modelEntries }

		const argsHandle = this.vm.wrapValue(args)
		const ctxHandle = this.vm.wrapValue({ id, chain, address, blockhash, timestamp })
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

	private createAPI(model: Model): QuickJSHandle {
		const primaryKeyProperty = model.properties.find((property) => property.kind === "primary")
		assert(primaryKeyProperty !== undefined)

		return this.vm.wrapObject({
			get: this.vm.wrapFunction((key) => {
				assert(this.#context !== null, "expected this.#context !== null")
				assert(typeof key === "string")
				return this.getModelValue(this.#context.modelEntries, this.#context.id, model.name, key)
			}),
			set: this.vm.context.newFunction(`db.${model.name}.set`, (valueHandle) => {
				assert(this.#context !== null, "expected this.#modelEntries !== null")
				const value = this.unwrapModelValue(model, valueHandle)
				this.#context.modelEntries[model.name][primaryKeyProperty.name] = value
			}),
			delete: this.vm.context.newFunction(`db.${model.name}.delete`, (keyHandle) => {
				assert(this.#context !== null, "expected this.#modelEntries !== null")
				const key = this.vm.context.getString(keyHandle)
				this.#context.modelEntries[model.name][key] = null
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
		if (property.kind === "primary") {
			return this.vm.context.getString(handle)
		} else if (property.kind === "primitive") {
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
			// // TODO: this might need to be consumed...
			// return this.vm.unwrapArray(handle, (elementHandle) => this.vm.context.getString(elementHandle))
			return this.vm.unwrapArray(handle, (elementHandle) => elementHandle.consume(this.vm.context.getString))
		} else {
			signalInvalidType(property)
		}
	}
}
