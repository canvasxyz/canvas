import { assert } from "@canvas-js/utils"
import { ActionContext, Actions, DeriveModelTypes, ModelInit, ModelSchema, RulesInit } from "../types.js"
import { capitalize } from "../utils.js"

export const extractRulesFromModelSchema = (models: ModelSchema) => {
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

	return { schema, rules }
}

export const generateActions = <T extends ModelSchema>(rules: Record<string, RulesInit>, models: T) => {
	const actions: Actions<T> = {}

	for (const [modelName, modelRules] of Object.entries(rules)) {
		/**
		 * Create rules run on the data that is being *written* to a database row.
		 * Update/delete rules run on the data that is being *read from* a database row.
		 */
		const createRule = modelRules["create"].toString()
		const updateRule = modelRules["update"].toString()
		const deleteRule = modelRules["delete"].toString()

		/**
		 * These functions use outside variables from the closure:
		 *
		 * - createRule, updateRule, deleteRule: string
		 * - modelName: string
		 * - models: {} // used to access model schema information for pk lookups
		 */

		const createAction = async function proxiedCreateAction(
			this: ActionContext<DeriveModelTypes<T>>,
			newModel: DeriveModelTypes<T>[string],
		) {
			console.log("createAction", this, newModel)
			const ruleFunction = new Function("$model", `with ($model) { return (${createRule}) }`)
			const result = ruleFunction.call(this, newModel)
			if (result !== true) {
				throw new Error(
					`Create rule check failed: ${createRule} returned ${result}, context: ${JSON.stringify({ ...newModel, this: this })}`,
				)
			}

			await this.db.set(modelName, newModel)
		}

		const updateAction = async function proxiedUpdateAction(
			this: ActionContext<DeriveModelTypes<T>>,
			newModel: Partial<DeriveModelTypes<T>[string]>,
		) {
			const findPrimaryKey = (m: ModelInit) => {
				if (models[modelName]["$primary"] !== undefined) {
					return models[modelName]["$primary"]
				}
				const tuple = Object.entries(m).find(([k, v]) => {
					return v === "primary"
				})
				if (!tuple) {
					throw new Error("Must provide model primary key")
				}
				return tuple[0]
			}

			const primaryKey = models[modelName]["$primary"] ?? findPrimaryKey(models[modelName])
			assert(
				primaryKey in newModel && typeof newModel[primaryKey as keyof typeof newModel] === "string",
				"Must provide model primary key",
			)
			const existingModel = await this.db.get(modelName, newModel[primaryKey as keyof typeof newModel] as string)

			// check update rule
			const updateRuleFunction = new Function("$model", `with ($model) { return (${updateRule}) }`)
			const updateResult = updateRuleFunction.call(this, existingModel)
			if (updateResult !== true) {
				throw new Error(
					`Update rule check failed: ${updateRule} returned ${updateResult}, context: ${JSON.stringify({ ...existingModel, this: this })}`,
				)
			}

			// check create rule
			const createRuleFunction = new Function("$model", `with ($model) { return (${createRule}) }`)
			const createResult = createRuleFunction.call(this, newModel)
			if (createResult !== true) {
				throw new Error(
					`Create rule check failed: ${createRule} returned ${createResult}, context: ${JSON.stringify({ ...newModel, this: this })}`,
				)
			}

			await this.db.update(modelName, newModel)
		}
		const deleteAction = async function proxiedDeleteAction(this: ActionContext<DeriveModelTypes<T>>, pk: string) {
			const existing = await this.db.get(modelName, pk)

			// check delete rule
			const deleteRuleFunction = new Function("$model", `with ($model) { return (${deleteRule}) }`)
			const deleteResult = deleteRuleFunction.call(this, existing)
			if (deleteResult !== true) {
				throw new Error(
					`Delete rule check failed: ${deleteRule} returned ${deleteResult}, context: ${pk}, ${JSON.stringify({ this: this })}`,
				)
			}

			await this.db.delete(modelName, pk)
		}

		const action = capitalize(modelName)
		actions[`create${action}`] = createAction
		actions[`update${action}`] = updateAction
		actions[`delete${action}`] = deleteAction
	}

	return actions
}
