import type { Action, CBORValue, SessionSigner } from "@canvas-js/interfaces"
import { AbstractModelDB, ModelValue, validateModelValue } from "@canvas-js/modeldb"

import target from "#target"

import { assert, mapValues } from "../utils.js"

import { ActionImplementation, InlineContract, ModelAPI } from "./types.js"
import { AbstractRuntime } from "./AbstractRuntime.js"

export class FunctionRuntime extends AbstractRuntime {
	public static async init(
		location: string | null,
		signers: SessionSigner[],
		contract: InlineContract,
		options: { indexHistory?: boolean } = {}
	): Promise<FunctionRuntime> {
		const { indexHistory = true } = options
		if (indexHistory) {
			const db = await target.openDB(location, "models", {
				...contract.models,
				...AbstractRuntime.sessionsModel,
				...AbstractRuntime.effectsModel,
			})
			return new FunctionRuntime(signers, db, contract.actions, indexHistory)
		} else {
			const db = await target.openDB(location, "models", {
				...contract.models,
				...AbstractRuntime.sessionsModel,
				...AbstractRuntime.versionsModel,
			})

			return new FunctionRuntime(signers, db, contract.actions, indexHistory)
		}
	}

	constructor(
		public readonly signers: SessionSigner[],
		public readonly db: AbstractModelDB,
		public readonly actions: Record<string, ActionImplementation<CBORValue, CBORValue>>,
		indexHistory: boolean
	) {
		super(indexHistory)
	}

	public get actionNames() {
		return Object.keys(this.actions)
	}

	protected async execute(
		modelEntries: Record<string, Record<string, ModelValue | null>>,
		id: string,
		action: Action
	): Promise<CBORValue | void> {
		const { chain, address, name, args, blockhash, timestamp } = action
		assert(this.actions[name] !== undefined, `invalid action name: ${name}`)

		const api = mapValues(this.db.models, (model): ModelAPI => {
			const primaryKeyProperty = model.properties.find((property) => property.kind === "primary")
			assert(primaryKeyProperty !== undefined)

			return {
				get: async (key: string) => {
					if (this.indexHistory) {
						throw new Error("not implemented")

						// if (modelEntries[model.name][key] !== undefined) {
						// 	return modelEntries[model.name][key]
						// }

						// return null
					} else {
						throw new Error("cannot call .get if indexHistory is disabled")
					}
				},
				set: async (value: ModelValue) => {
					validateModelValue(model, value)
					const key = value[primaryKeyProperty.name] as string
					modelEntries[model.name][key] = value
				},
				delete: async (key: string) => {
					modelEntries[model.name][key] = null
				},
			}
		})

		const result = await this.actions[name](api, args, { id, chain, address, blockhash, timestamp })
		return result as CBORValue | void
	}
}
