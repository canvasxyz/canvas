import type { Action, SessionSigner } from "@canvas-js/interfaces"
import type { JSValue } from "@canvas-js/vm"
import { AbstractModelDB, ModelValue, ModelsInit, validateModelValue } from "@canvas-js/modeldb"

import { PlatformTarget } from "../targets/interface.js"
import { assert, mapValues } from "../utils.js"

import { AbstractRuntime } from "./AbstractRuntime.js"
import { ActionImplementation, ModelAPI } from "./types.js"

export class FunctionRuntime extends AbstractRuntime {
	public static async init(
		target: PlatformTarget,
		signers: SessionSigner[],
		contract: { topic: string; models: ModelsInit; actions: Record<string, ActionImplementation> },
		options: { indexHistory?: boolean } = {}
	): Promise<FunctionRuntime> {
		const { indexHistory = true } = options
		if (indexHistory) {
			const db = await target.openDB("models", {
				...contract.models,
				...AbstractRuntime.sessionsModel,
				...AbstractRuntime.effectsModel,
			})
			return new FunctionRuntime(signers, contract.topic, db, contract.actions, indexHistory)
		} else {
			const db = await target.openDB("models", {
				...contract.models,
				...AbstractRuntime.sessionsModel,
				...AbstractRuntime.versionsModel,
			})

			return new FunctionRuntime(signers, contract.topic, db, contract.actions, indexHistory)
		}
	}

	constructor(
		public readonly signers: SessionSigner[],
		public readonly topic: string,
		public readonly db: AbstractModelDB,
		public readonly actions: Record<string, ActionImplementation>,
		indexHistory: boolean
	) {
		super(indexHistory)
	}

	public get actionNames() {
		return Object.keys(this.actions)
	}

	protected async execute(
		// gossipLog: AbstractGossipLog<Action | Session, void | JSValue>,
		modelEntries: Record<string, Record<string, ModelValue | null>>,
		id: string,
		action: Action
	): Promise<JSValue | void> {
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

		return await this.actions[name](api, args, { id, chain, address, blockhash, timestamp })
	}
}
