import { assert } from "@canvas-js/utils"

import { Config, Model, ModelSchema, PrimitiveType, Property, PropertyType, Relation } from "./types.js"
import { namePattern } from "./utils.js"

export function parseConfig(init: ModelSchema): Config {
	const relations: Relation[] = []
	const models: Model[] = []

	for (const [modelName, { $indexes, ...rest }] of Object.entries(init)) {
		assert(
			namePattern.test(modelName),
			`error defining ${modelName}: expected model name to match /^[a-zA-Z0-9$:_\\-\\.]+$/`,
		)

		const primaryKeys: string[] = []
		const indexes: string[][] = []
		const properties: Record<string, Property> = {}

		for (const [propertyName, propertyType] of Object.entries(rest)) {
			assert(
				!Array.isArray(propertyType),
				`error defining ${modelName}: invalid property type for ${propertyName}: ${propertyType}`,
			)
			assert(
				typeof propertyType !== "function",
				`error defining ${modelName}: invalid property type for ${propertyName}`,
			)

			const [property, primary] = parseProperty(modelName, propertyName, propertyType)
			if (primary) {
				primaryKeys.push(propertyName)
			}

			properties[propertyName] = property

			if (property.kind === "relation") {
				relations.push({
					source: modelName,
					property: propertyName,
					target: property.target,
					indexed: $indexes?.includes(propertyName) ?? false,
				})
			}
		}

		if (primaryKeys.length !== 1) {
			throw new Error(`error defining ${modelName}: models must have exactly one "primary" property`)
		}

		const [primaryKey] = primaryKeys

		for (const index of $indexes ?? []) {
			if (relations.some((relation) => relation.source === modelName && relation.property === index)) {
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

	return { relations, models }
}

export const primitivePropertyPattern = /^(integer|float|number|string|bytes|boolean|json)(\??)$/
export const referencePropertyPattern = /^@([a-z0-9.-]+)(\??)$/
export const relationPropertyPattern = /^@([a-z0-9.-]+)\[\]$/

export function parseProperty(
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
