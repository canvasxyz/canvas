import { TypeTransformerFunction, create as createIpld } from "@ipld/schema/typed.js"
import { fromDSL } from "@ipld/schema/from-dsl.js"
import type pg from "pg"

import type { SignerCache } from "@canvas-js/interfaces"
import { AbstractModelDB, ModelSchema, ModelValue, validateModelValue, mergeModelValues } from "@canvas-js/modeldb"
import { assert, filterMapEntries } from "@canvas-js/utils"

import target from "#target"

import {
	ActionImplementation,
	ActionImplementationFunction,
	ActionImplementationObject,
	CapturedImportType,
	ImportType,
	Contract,
	ModelAPI,
} from "../types.js"
import { captureImport, uncaptureImports } from "../imports.js"
import { AbstractRuntime, ExecutionContext } from "./AbstractRuntime.js"

const identity = (x: any) => x

export class FunctionRuntime extends AbstractRuntime {
	public static async init(topic: string, signers: SignerCache, contract: Contract): Promise<FunctionRuntime> {
		assert(contract.actions !== undefined, "contract initialized without actions")
		assert(contract.models !== undefined, "contract initialized without models")

		const schema = AbstractRuntime.getModelSchema(contract.models)
		// const db = await target.openDB({ path, topic }, schema)

		const argsTransformers: Record<
			string,
			{ toTyped: TypeTransformerFunction; toRepresentation: TypeTransformerFunction }
		> = {}

		if (contract.globals && Object.keys(contract.globals).length !== 0) {
			throw new Error("cannot initialize FunctionRuntime with globals")
		}

		const actions = filterMapEntries(
			contract.actions,
			([actionName, action]) => actionName !== "$imports",
			([actionName, action]: [string, ActionImplementation]) => {
				if (typeof action === "function") {
					argsTransformers[actionName] = { toTyped: identity, toRepresentation: identity }
					return action as ActionImplementationFunction
				}

				if (action.argsType !== undefined) {
					const { schema, name } = action.argsType
					argsTransformers[actionName] = createIpld(fromDSL(schema), name)
				} else {
					argsTransformers[actionName] = { toTyped: identity, toRepresentation: identity }
				}

				return action.apply
			},
		)

		return new FunctionRuntime(topic, signers, schema, actions, argsTransformers)
	}

	#context: ExecutionContext | null = null
	readonly #db: ModelAPI

	constructor(
		public readonly topic: string,
		public readonly signers: SignerCache,
		public readonly schema: ModelSchema,
		public readonly actions: Record<string, ActionImplementationFunction>,
		public readonly argsTransformers: Record<
			string,
			{ toTyped: TypeTransformerFunction; toRepresentation: TypeTransformerFunction }
		>,
	) {
		super()

		this.#db = {
			get: async <T extends ModelValue = ModelValue>(model: string, key: string) => {
				assert(this.#context !== null, "expected this.#context !== null")
				return await this.getModelValue<T>(this.#context, model, key)
			},
			set: async (model: string, value: ModelValue) => {
				assert(this.#context !== null, "expected this.#context !== null")
				validateModelValue(this.db.models[model], value)
				const { primaryKey } = this.db.models[model]
				const key = value[primaryKey] as string
				this.#context.modelEntries[model][key] = value
			},
			merge: async (model: string, value: ModelValue) => {
				assert(this.#context !== null, "expected this.#context !== null")
				const { primaryKey } = this.db.models[model]
				const key = value[primaryKey] as string
				const mergedValue = mergeModelValues(value, (await this.getModelValue(this.#context, model, key)) ?? {})
				validateModelValue(this.db.models[model], mergedValue)
				this.#context.modelEntries[model][key] = mergedValue
			},
			delete: async (model: string, key: string) => {
				assert(this.#context !== null, "expected this.#context !== null")
				this.#context.modelEntries[model][key] = null
			},
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

		const argsTransformer = this.argsTransformers[name]
		const action = this.actions[name]
		if (action === undefined || argsTransformer === undefined) {
			throw new Error(`invalid action name: ${name}`)
		}

		const typedArgs = argsTransformer.toTyped(args)
		assert(typedArgs !== undefined, "action args did not validate the provided schema type")

		this.#context = context

		try {
			return await action(
				this.#db,
				typedArgs,
				{
					id: context.id,
					publicKey,
					did,
					address,
					blockhash: blockhash ?? null,
					timestamp,
				},
			)
		} finally {
			this.#context = null
		}
	}
}
