import { assert } from "@canvas-js/utils"
import { ActionContext, Actions, DeriveModelTypes, ModelSchema, RulesInit } from "../types.js"
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

export const generateActions = <T extends ModelSchema>(rules: Record<string, RulesInit>) => {
	const actions: Actions<T> = {}

	for (const [modelName, modelRules] of Object.entries(rules)) {
		/**
		 * Create rules run on the data that is being *written* a model.
		 * Update/delete rules run on the data that is being *read from* in a model, from a local perspective.
		 */
		const createRule = modelRules["create"]
		const updateRule = modelRules["update"]
		const deleteRule = modelRules["delete"]

		const checkCreateRule = async (rule: string, context: ActionContext<DeriveModelTypes<T>>, newModel: any) => {
			const ruleFunction = new Function("$model", `with ($model) { return (${rule}) }`)
			const result = ruleFunction.call(context, newModel)
			assert(
				result === true,
				`Create rule check failed: ${rule} returned ${result}, context: ${JSON.stringify({ ...newModel, this: context })}`,
			)
		}
		const checkUpdateDeleteRule = async (
			rule: string,
			context: ActionContext<DeriveModelTypes<T>>,
			existingModel: any,
			update?: boolean,
		) => {
			const ruleFunction = new Function("$model", `with ($model) { return (${rule}) }`)
			const result = ruleFunction.call(context, existingModel)
			assert(
				result === true,
				`${update ? "Update" : "Delete"} rule check failed: ${rule} returned ${result}, context: ${JSON.stringify({ ...existingModel, this: context })}`,
			)
		}

		const createAction = async function (
			this: ActionContext<DeriveModelTypes<T>>,
			createdModel: DeriveModelTypes<T>[string],
		) {
			if (createRule === false) {
				throw new Error("Disallowed by $rules.create")
			} else if (createRule === true) {
				await this.db.set(modelName, createdModel)
			} else {
				await checkCreateRule(createRule, this, createdModel)
				await this.db.set(modelName, createdModel)
			}
		}
		const updateAction = async function (
			this: ActionContext<DeriveModelTypes<T>>,
			updatedModel: Partial<DeriveModelTypes<T>[string]>,
		) {
			if (updateRule === false) {
				throw new Error("Disallowed by $rules.delete")
			} else if (updateRule === true) {
				assert("id" in updatedModel && typeof updatedModel.id === "string", "Must provide model primary key") // TODO: support PKs other than `id`

				if (createRule === false) {
					throw new Error("Disallowed by $rules.create")
				} else if (createRule !== true) {
					await checkCreateRule(createRule, this, updatedModel)
				}

				await this.db.update(modelName, updatedModel)
			} else {
				assert("id" in updatedModel && typeof updatedModel.id === "string", "Must provide model primary key") // TODO: support PKs other than `id`
				const existingModel = await this.db.get(modelName, updatedModel.id) // TODO: support PKs other than `id`
				await checkUpdateDeleteRule(updateRule, this, existingModel, true)

				if (createRule === false) {
					throw new Error("Disallowed by $rules.create")
				} else if (createRule !== true) {
					await checkCreateRule(createRule, this, updatedModel)
				}

				await this.db.update(modelName, updatedModel)
			}
		}
		const deleteAction = async function (this: ActionContext<DeriveModelTypes<T>>, pk: string) {
			if (deleteRule === false) {
				throw new Error("Disallowed by $rules.delete")
			} else if (deleteRule === true) {
				await this.db.delete(modelName, pk)
			} else {
				const existing = await this.db.get(modelName, pk)
				checkUpdateDeleteRule(deleteRule, this, existing)
				await this.db.delete(modelName, pk)
			}
		}

		const action = capitalize(modelName)
		const createActionName = `create${action}`
		const updateActionName = `update${action}`
		const deleteActionName = `delete${action}`

		actions[createActionName] = createAction
		actions[updateActionName] = updateAction
		actions[deleteActionName] = deleteAction
	}

	return actions
}
