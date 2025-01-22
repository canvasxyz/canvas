import { assert } from "@canvas-js/utils"

import { Model, ModelSchema, PrimitiveProperty, PrimitiveType, Property, PropertyType, Relation } from "./types.js"
import { namePattern } from "./utils.js"

export const primitivePropertyPattern = /^(integer|float|number|string|bytes|boolean|json)(\??)$/
export const referencePropertyPattern = /^@([a-z0-9.-]+)(\??)$/
export const relationPropertyPattern = /^@([a-z0-9.-]+)\[\]$/

export class Config {
	public static parse(init: ModelSchema): Config {
		const relations: Relation[] = []
		const models: Model[] = []

		for (const [modelName, { $indexes, $primary, ...rest }] of Object.entries(init)) {
			if (!namePattern.test(modelName)) {
				throw new Error(`error defining ${modelName}: expected model name to match /^[a-zA-Z0-9$:_\\-\\.]+$/`)
			}

			const primaryKey = $primary?.split("/") ?? []
			const indexes: string[][] = []
			const properties: Record<string, Property> = {}

			for (const [propertyName, propertyType] of Object.entries(rest)) {
				const [property, primary] = Config.parseProperty(modelName, propertyName, propertyType)
				if (primary) {
					if ($primary === undefined && primaryKey.length > 0) {
						throw new Error(
							"cannot have duplicate 'primary' keys - use $primary: 'a/b/c' syntax for composite primary keys",
						)
					} else if ($primary !== undefined) {
						throw new Error("'primary' properties cannot be used in conjunction with composite $primary keys")
					} else {
						primaryKey.push(propertyName)
					}
				}

				properties[propertyName] = property

				if (property.kind === "relation") {
					relations.push({
						source: modelName,
						sourceProperty: propertyName,
						target: property.target,
						indexed: $indexes?.includes(propertyName) ?? false,
					})
				}
			}

			for (const name of primaryKey) {
				const property = properties[name]
				assert(property.kind === "primitive", "primary keys must have type integer, string, or bytes")
				assert(
					property.type === "integer" || property.type === "string" || property.type === "bytes",
					"primary keys must have type integer, string, or bytes",
				)
				assert(property.nullable === false, "primary keys cannot be nullable")
			}

			if (primaryKey.length === 0) {
				throw new Error(`error defining ${modelName}: models must have at least one primary key`)
			}

			for (const index of $indexes ?? []) {
				if (relations.some((relation) => relation.source === modelName && relation.sourceProperty === index)) {
					continue
				}

				const propertyNames = index.split("/")
				for (const propertyName of propertyNames) {
					assert(properties[propertyName] !== undefined, "invalid index property", { propertyName })
					assert(properties[propertyName].kind !== "relation", "cannot index relation properties")
				}

				indexes.push(propertyNames)
			}

			models.push({ name: modelName, primaryKey, properties: Object.values(properties), indexes })
		}

		// const relations = baseRelations.map((relation) => {
		// 	const sourceModel = models.find((model) => model.name === relation.source)
		// 	if (sourceModel === undefined) {
		// 		throw new Error(`invalid model schema: invalid relation source "${relation.source}" (no such model)`)
		// 	}

		// 	const sourcePrimaryKey: PrimitiveProperty[] = []
		// 	for (const property of sourceModel.properties) {
		// 		if (property.kind === "primitive" && sourceModel.primaryKey.includes(property.name)) {
		// 			sourcePrimaryKey.push(property)
		// 		}
		// 	}

		// 	const targetModel = models.find((model) => model.name === relation.target)
		// 	if (targetModel === undefined) {
		// 		throw new Error(`invalid model schema: invalid relation target "${relation.target}" (no such model)`)
		// 	}

		// 	const targetPrimaryKey: PrimitiveProperty[] = []
		// 	for (const property of targetModel.properties) {
		// 		if (property.kind === "primitive" && targetModel.primaryKey.includes(property.name)) {
		// 			targetPrimaryKey.push(property)
		// 		}
		// 	}

		// 	return { ...relation, sourcePrimaryKey, targetPrimaryKey }
		// })

		return new Config(models, relations)
	}

	private static parseProperty(
		modelName: string,
		propertyName: string,
		propertyType: PropertyType,
	): [property: Property, primary: boolean] {
		assert(
			namePattern.test(propertyName),
			`error defining ${modelName}: expected property names to match /^[a-zA-Z0-9$:_\\-\\.]+$/`,
		)

		if (propertyType === "primary") {
			return [{ name: propertyName, kind: "primitive", type: "string", nullable: false }, true]
		}

		const primitiveResult = primitivePropertyPattern.exec(propertyType)
		if (primitiveResult !== null) {
			const [_, type, nullable] = primitiveResult

			// json fields are already nullable
			if (type === "json" && nullable === "?") {
				throw new Error(
					`error defining ${modelName}.${propertyName}: json fields already accept null, and should not be declared as nullable`,
				)
			}

			return [{ name: propertyName, kind: "primitive", type: type as PrimitiveType, nullable: nullable === "?" }, false]
		}

		const referenceResult = referencePropertyPattern.exec(propertyType)
		if (referenceResult !== null) {
			const [_, target, nullable] = referenceResult
			return [{ name: propertyName, kind: "reference", target, nullable: nullable === "?" }, false]
		}

		const relationResult = relationPropertyPattern.exec(propertyType)
		if (relationResult !== null) {
			const [_, target] = relationResult
			return [{ name: propertyName, kind: "relation", target: target }, false]
		}

		throw new Error(`error defining ${modelName}: invalid property "${propertyType}"`)
	}

	public readonly primaryKeys: Record<string, PrimitiveProperty[]>

	public constructor(public readonly models: Model[], public readonly relations: Relation[]) {
		this.primaryKeys = {}
		for (const model of models) {
			this.primaryKeys[model.name] = model.primaryKey.map((name) => {
				const property = model.properties.find((property) => property.name === name)
				assert(property !== undefined)
				assert(property.kind === "primitive")
				assert(property.type === "integer" || property.type === "string" || property.type === "bytes")
				assert(property.nullable === false)
				return property
			})
		}

		for (const relation of relations) {
			const source = models.find((model) => model.name === relation.source)
			if (source === undefined) {
				throw new Error(`invalid relation source - no "${relation.source}" model`)
			}

			const target = models.find((model) => model.name === relation.target)
			if (target === undefined) {
				throw new Error(`invalid relation target - no "${relation.target}" model`)
			}
		}
	}
}
