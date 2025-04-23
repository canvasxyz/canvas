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
		 * Update/delete rules run on the data that is being *read from* a database row,
		 * necessarily from a local perspective.
		 */
		const createRule = modelRules["create"]
		const updateRule = modelRules["update"]
		const deleteRule = modelRules["delete"]

		const checkCreateRule = async (rule: string, context: ActionContext<DeriveModelTypes<T>>, newModel: any) => {
			const ruleFunction = new Function("$model", `with ($model) { return (${rule}) }`)
			const result = ruleFunction.call(context, newModel)
			if (result !== true) {
                const contextString = JSON.stringify({ ...newModel, this: context })
				throw new Error(
					`Create rule check failed: ${rule} returned ${result}, context: ${contextString}`,
				)
			}
		}
		const checkUpdateDeleteRule = async (
			rule: string,
			context: ActionContext<DeriveModelTypes<T>>,
			existingModel: any,
			update?: boolean,
		) => {
			const ruleFunction = new Function("$model", `with ($model) { return (${rule}) }`)
			const result = ruleFunction.call(context, existingModel)
			if (result !== true) {
                const contextString = JSON.stringify({ ...existingModel, this: context })
				throw new Error(
					`${update ? "Update" : "Delete"} rule check failed: ${rule} returned ${result}, context: ${contextString}`,
				)
			}
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

			if (updateRule === false) {
				throw new Error("Disallowed by $rules.delete")
			} else if (updateRule === true) {
                const primaryKey = findPrimaryKey(models[modelName])
				assert(primaryKey in updatedModel && typeof updatedModel[primaryKey as keyof typeof updatedModel] === "string", "Must provide model primary key")

				if (createRule === false) {
					throw new Error("Disallowed by $rules.create")
				} else if (createRule !== true) {
					await checkCreateRule(createRule, this, updatedModel)
				}

				await this.db.update(modelName, updatedModel)
			} else {
                const primaryKey = models[modelName]["$primary"] ?? findPrimaryKey(models[modelName])
				assert(primaryKey in updatedModel && typeof updatedModel[primaryKey as keyof typeof updatedModel] === "string", "Must provide model primary key")
				const existingModel = await this.db.get(modelName, updatedModel[primaryKey as keyof typeof updatedModel] as string)
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
