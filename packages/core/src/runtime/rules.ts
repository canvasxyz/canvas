import { assert } from "@canvas-js/utils"
import { ActionContext, Actions, DeriveModelTypes, ModelInit, ModelSchema, RulesInit } from "../types.js"
import { capitalize } from "../utils.js"

const toString = (err: unknown) => {
	return typeof err === "object" && err !== null && "message" in err ? String(err.message) : String(err)
}

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

export const generateActionsFromRules = <T extends ModelSchema>(rules: Record<string, RulesInit>, models: T) => {
	const actions: Actions<T> = {}

	for (const [modelName, modelRules] of Object.entries(rules)) {
		/**
		 * Create rules run on the data that is being *written* to a database row.
		 * Update/delete rules run on the data that is being *read from* a database row.
		 */
		const createRule = modelRules["create"].toString()
		const updateRule = modelRules["update"].toString()
		const deleteRule = modelRules["delete"].toString()

		const createAction = async function proxiedCreateAction(
			this: ActionContext<DeriveModelTypes<T>>,
			newModel: DeriveModelTypes<T>[string],
		) {
			// check create rule
			const ruleFunction = new Function("$model", `with ($model) { return (${createRule}) }`)
			let result = false
			try {
				result = ruleFunction.call(this, newModel)
			} catch (error) {
				throw new Error(`Create rule execution failed, ${toString(error)}: ${createRule}`)
			}

			if (result !== true) {
				const ctx = JSON.stringify({ ...newModel, this: this }, null, "  ")
				throw new Error(`Create rule check failed: \`${createRule}\` ${ctx}`)
			}

			await this.db.transaction(async () => await this.db.create(modelName, newModel))
		}

		const updateAction = async function proxiedUpdateAction(
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
				const updateRuleFunction = new Function("$model", `with ($model) { return (${updateRule}) }`)
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
				const createRuleFunction = new Function("$model", `with ($model) { return (${createRule}) }`)
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

		const deleteAction = async function proxiedDeleteAction(this: ActionContext<DeriveModelTypes<T>>, pk: string) {
			const existing = await this.db.get(modelName, pk)

			// check delete rule
			const deleteRuleFunction = new Function("$model", `with ($model) { return (${deleteRule}) }`)
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

		const action = capitalize(modelName)
		actions[`create${action}`] = createAction
		actions[`update${action}`] = updateAction
		actions[`delete${action}`] = deleteAction
	}

	return actions
}
