import { assert, mapEntries } from "@canvas-js/utils"

import { Contract } from "@canvas-js/core/contract"
import { ActionContext, DeriveModelTypes, ModelSchema, RulesInit } from "../types.js"

const toString = (err: unknown) => {
	return typeof err === "object" && err !== null && "message" in err ? String(err.message) : String(err)
}

export const extractRules = (models: ModelSchema) => {
	const rules: Record<string, RulesInit> = {}
	const schema: ModelSchema = {}

	for (const modelName of Object.keys(models)) {
		const model = models[modelName]

		if ("$rules" in model) {
			rules[modelName] = model.$rules as RulesInit
		}

		schema[modelName] = { ...model }
		if ("$rules" in schema[modelName]) {
			delete schema[modelName].$rules
		}
	}

	return { baseModels: schema, rules }
}

export function generateActionsFromRules<T extends ModelSchema>(rules: Record<string, RulesInit>, models: T) {
	return mapEntries(rules, ([modelName, modelRules]) => {
		/**
		 * Create rules run on the data that is being *written* to a database row.
		 * Update/delete rules run on the data that is being *read from* a database row.
		 */
		const createRule = modelRules["create"].toString()
		const updateRule = modelRules["update"].toString()
		const deleteRule = modelRules["delete"].toString()

		const createRuleFunction = new Function("$model", `with ($model) { return (${createRule}) }`)
		const updateRuleFunction = new Function("$model", `with ($model) { return (${updateRule}) }`)
		const deleteRuleFunction = new Function("$model", `with ($model) { return (${deleteRule}) }`)

		async function createAction(this: ActionContext<DeriveModelTypes<T>>, newModel: DeriveModelTypes<T>[string]) {
			// check create rule
			let result = false
			try {
				result = createRuleFunction.call(this, newModel)
			} catch (error) {
				throw new Error(`Create rule execution failed, ${toString(error)}: ${createRule}`)
			}

			if (result !== true) {
				const ctx = JSON.stringify({ ...newModel, this: this }, null, "  ")
				throw new Error(`Create rule check failed: \`${createRule}\` ${ctx}`)
			}

			await this.db.transaction(async () => await this.db.create(modelName, newModel))
		}

		async function updateAction(
			this: ActionContext<DeriveModelTypes<T>>,
			newModel: Partial<DeriveModelTypes<T>[string]>,
		) {
			const primaryKey =
				models[modelName]["$primary"] ?? Object.entries(models[modelName]).find(([k, v]) => v === "primary")?.[0]
			assert(
				primaryKey && primaryKey in newModel && typeof newModel[primaryKey as keyof typeof newModel] === "string",
				"Must provide model primary key",
			)
			const existingModel = await this.db.get(modelName, newModel[primaryKey as keyof typeof newModel] as string)

			{
				// check update rule

				let updateResult = false
				try {
					updateResult = updateRuleFunction.call(this, existingModel)
				} catch (error) {
					throw new Error(`Update rule execution failed, ${toString(error)}: ${updateRule}`)
				}

				if (updateResult !== true) {
					const ctx = JSON.stringify({ ...newModel, this: this }, null, "  ")
					throw new Error(`Update rule check failed: \`${updateRule}\` ${ctx}`)
				}
			}

			{
				// check create rule

				let createResult
				try {
					createResult = createRuleFunction.call(this, newModel)
				} catch (error) {
					throw new Error(`Create rule execution failed, ${toString(error)}: ${createRule}`)
				}

				if (createResult !== true) {
					const ctx = JSON.stringify({ ...newModel, this: this }, null, "  ")
					throw new Error(`Create rule check failed: \`${updateRule}\` ${ctx}`)
				}
			}

			await this.db.transaction(async () => await this.db.update(modelName, newModel))
		}

		async function deleteAction(this: ActionContext<DeriveModelTypes<T>>, pk: string) {
			const existing = await this.db.get(modelName, pk)

			// check delete rule

			let deleteResult
			try {
				deleteResult = deleteRuleFunction.call(this, existing)
			} catch (error) {
				throw new Error(`Delete rule execution failed, ${toString(error)}: ${deleteRule}`)
			}

			if (deleteResult !== true) {
				const ctx = JSON.stringify({ this: this }, null, "  ")
				throw new Error(`Delete rule check failed: \`${updateRule}\` ${ctx}`)
			}

			await this.db.transaction(async () => await this.db.delete(modelName, pk))
		}

		return {
			create: createAction,
			update: updateAction,
			delete: deleteAction,
		}
	})
}
