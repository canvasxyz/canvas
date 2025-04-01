import { QuickJSHandle } from "quickjs-emscripten"

import type { SignerCache } from "@canvas-js/interfaces"
import { ModelValue, ModelSchema } from "@canvas-js/modeldb"
import { VM } from "@canvas-js/vm"
import { assert, mapValues } from "@canvas-js/utils"

import { Contract } from "../types.js"
import { ExecutionContext } from "../ExecutionContext.js"
import { AbstractRuntime } from "./AbstractRuntime.js"

/**
 * Look for the QuickJS module in the compile stack trace.
 * TODO: Extract all stack trace rewriting functions into a util
 *
 * #### JavaScriptCore
 * baz@filename.js:10:24
 * bar@filename.js:6:6
 * foo@filename.js:2:6
 * global code@filename.js:13:4
 *
 * #### SpiderMonkey
 * baz@filename.js:10:15
 * bar@filename.js:6:3
 * foo@filename.js:2:3
 * @filename.js:13:1
 *
 * #### V8
 * Error
 *     at baz (filename.js:10:15)
 *     at bar (filename.js:6:3)
 *     at foo (filename.js:2:3)
 *     at filename.js:13:1
 */
const rewriteContractBuildErrors = (err: Error) => {
	if (err.stack === undefined) return

	const split = err.stack.split('\n')
	const isV8ErrorRegexp = /^[a-zA-Z0-9]+:/
	const isModuleErrorRegexp = /at [a-zA-Z0-9]+\.consume.*:[0-9]+:[0-9]+\)/
	const moduleError = split.find((row) => row.match(isModuleErrorRegexp))

	const isV8Error = split[0].match(isV8ErrorRegexp)
	if (moduleError) {
		err.stack = isV8Error ? [split[0], moduleError].join('\n') : moduleError
	}
}

function charIndexToLinePosition(text: string, charIndex: number) {
	// Ensure charIndex is within bounds
	if (charIndex < 0 || charIndex > text.length) {
		throw new Error(`Index ${charIndex} is out of bounds for text of length ${text.length}`);
	}

	const textUpToIndex = text.substring(0, charIndex);
	const lines = textUpToIndex.split('\n');
	const lineNumber = lines.length - 1;
	const column = lines[lines.length - 1].length;

	return {
		line: lineNumber,
		column: column
	};
}

export class ContractRuntime extends AbstractRuntime {
	public static async init(
		topic: string,
		signers: SignerCache,
		contract: string,
		options: { runtimeMemoryLimit?: number } = {},
	): Promise<ContractRuntime> {
		const { runtimeMemoryLimit } = options

		const vm = await VM.initialize({ runtimeMemoryLimit })

		let contractInit: Record<string, QuickJSHandle>

		// Rewrite contract build errors
		try {
			contractInit = vm.import(contract).consume(vm.unwrapObject)
		} catch (err: any) {
			rewriteContractBuildErrors(err)
			throw err
		}

		const {
			contract: contractHandle,
			models: modelsHandle,
			actions: actionsHandle,
			...rest
		} = contractInit

		for (const [name, handle] of Object.entries(rest)) {
			console.warn(`extraneous export ${JSON.stringify(name)}`)
			handle.dispose()
		}

		let actionHandles: Record<string, QuickJSHandle>
		let modelHandles: Record<string, QuickJSHandle>
		if (contractHandle !== undefined) {
			assert(actionsHandle === undefined, "cannot export both `contract` and `actions`")
			assert(modelsHandle === undefined, "cannot export both `contract` and `models`")
			const { actions, models, ...rest } = contractHandle.consume(vm.unwrapObject)
			assert(actions !== undefined, "missing `actions` in contract export")
			assert(models !== undefined, "missing `models` in contract export")
			actionHandles = actions.consume(vm.unwrapObject)
			modelHandles = models.consume(vm.unwrapObject)
			for (const [key, value] of Object.entries(rest)) {
				console.warn(`extraneous entry "${key}" in contract export`)
				value.dispose()
			}
		} else {
			assert(actionsHandle !== undefined, "missing `actions` export")
			assert(modelsHandle !== undefined, "missing `models` export")
			actionHandles = actionsHandle.consume(vm.unwrapObject)
			modelHandles = modelsHandle.consume(vm.unwrapObject)
		}

		const actions = mapValues(actionHandles, (handle) => {
			assert(vm.context.typeof(handle) === "function", "expected action handle to be a function")
			return handle.consume(vm.cache)
		})

		const modelSchema: ModelSchema = mapValues(modelHandles, (handle) => handle.consume(vm.context.dump))
		assert(
			Object.keys(modelSchema).every((key) => !key.startsWith("$")),
			"contract model names cannot start with '$'",
		)

		return new ContractRuntime(topic, signers, modelSchema, vm, actions, contract)
	}

	readonly #databaseAPI: QuickJSHandle

	#context: ExecutionContext | null = null

	constructor(
		public readonly topic: string,
		public readonly signers: SignerCache,
		public readonly models: ModelSchema,
		public readonly vm: VM,
		public readonly actions: Record<string, QuickJSHandle>,
		public readonly contract: string | Contract<any, any>,
	) {
		super(models)
		this.#databaseAPI = vm
			.wrapObject({
				get: vm.wrapFunction((model, key) => {
					assert(typeof model === "string", 'expected typeof model === "string"')
					assert(typeof key === "string", 'expected typeof key === "string"')
					return this.context.getModelValue(model, key)
				}),
				set: vm.context.newFunction("set", (modelHandle, valueHandle) => {
					const model = vm.context.getString(modelHandle)
					const value = this.vm.unwrapValue(valueHandle) as ModelValue
					this.context.setModelValue(model, value)
				}),
				create: vm.context.newFunction("create", (modelHandle, valueHandle) => {
					const model = vm.context.getString(modelHandle)
					const value = this.vm.unwrapValue(valueHandle) as ModelValue
					this.context.setModelValue(model, value)
				}),
				update: vm.context.newFunction("update", (modelHandle, valueHandle) => {
					const model = vm.context.getString(modelHandle)
					const value = this.vm.unwrapValue(valueHandle) as ModelValue

					const promise = vm.context.newPromise()

					// TODO: Ensure concurrent merges into the same value don't create a race condition
					// if the user doesn't call db.update() with await.
					this.context
						.updateModelValue(model, value)
						.then(() => promise.resolve())
						.catch((err) => promise.reject())

					promise.settled.then(vm.runtime.executePendingJobs)
					return promise.handle
				}),
				merge: vm.context.newFunction("merge", (modelHandle, valueHandle) => {
					const model = vm.context.getString(modelHandle)
					const value = this.vm.unwrapValue(valueHandle) as ModelValue

					const promise = vm.context.newPromise()

					// TODO: Ensure concurrent merges into the same value don't create a race condition
					// if the user doesn't call db.update() with await.
					this.context
						.mergeModelValue(model, value)
						.then(() => promise.resolve())
						.catch((err) => promise.reject())

					promise.settled.then(vm.runtime.executePendingJobs)
					return promise.handle
				}),

				delete: vm.context.newFunction("delete", (modelHandle, keyHandle) => {
					const model = vm.context.getString(modelHandle)
					const key = vm.context.getString(keyHandle)
					this.context.deleteModelValue(model, key)
				}),
			})
			.consume(vm.cache)
	}

	public close() {
		this.vm.dispose()
	}

	public get actionNames() {
		return Object.keys(this.actions)
	}

	private get context() {
		assert(this.#context !== null, "expected this.#context !== null")
		return this.#context
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

		const thisHandle = this.vm.wrapValue({
			id: context.id,
			publicKey,
			did,
			address,
			blockhash: blockhash ?? null,
			timestamp,
		})

		const argHandles = Array.isArray(args) ? args.map(this.vm.wrapValue) : [this.vm.wrapValue(args)]

		try {
			this.#context = context
			const result = await this.vm.callAsync(actionHandle, thisHandle, [this.#databaseAPI, ...argHandles])

			return result.consume((handle) => {
				if (this.vm.context.typeof(handle) === "undefined") {
					return undefined
				} else {
					return this.vm.unwrapValue(result)
				}
			})
		} finally {
			argHandles.map((handle: QuickJSHandle) => handle.dispose())
			thisHandle.dispose()
			this.#context = null
		}
	}
}
