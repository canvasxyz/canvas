import { assert } from "@canvas-js/utils"

import { Config, Model, ModelSchema, PrimitiveType, Property, PropertyType, Relation } from "./types.js"
import { namePattern } from "./utils.js"

export function parseConfig(init: ModelSchema): Config {
	const relations: Relation[] = []
	const models: Model[] = []

	for (const [modelName, { $indexes, $merge, ...rest }] of Object.entries(init)) {
		assert(
			namePattern.test(modelName),
			`error defining ${modelName}: expected model name to match /^[a-zA-Z0-9$:_\\-\\.]+$/`,
		)

		const indexes: string[][] = []
		const properties: Property[] = []

		for (const [propertyName, propertyType] of Object.entries(rest)) {
			assert(
				!Array.isArray(propertyType),
				`error defining ${modelName}: invalid property type for ${propertyName}: ${propertyType}`,
			)
			assert(
				typeof propertyType !== "function",
				`error defining ${modelName}: invalid property type for ${propertyName}`,
			)
			const property = parseProperty(modelName, propertyName, propertyType)

			properties.push(property)

			if (property.kind === "relation") {
				relations.push({
					source: modelName,
					property: propertyName,
					target: property.target,
					indexed: $indexes?.includes(propertyName) ?? false,
				})
			}
		}

		const primaryProperties = properties.filter((property) => property.kind === "primary")
		assert(
			primaryProperties.length === 1,
			`error defining ${modelName}: models must have exactly one "primary" property`,
		)
		const [{ name: primaryKey }] = primaryProperties

		if ($indexes !== undefined) {
			for (const index of $indexes) {
				if (relations.some((relation) => relation.source === modelName && relation.property === index)) {
					continue
				} else {
					indexes.push(Array.isArray(index) ? index : [index])
				}
			}
		}

		if ($merge !== undefined) {
			assert(typeof $merge === "function", `error defining ${modelName}: expected $merge to be a function`)
		}

		models.push({ name: modelName, primaryKey, properties, indexes, merge: $merge })
	}

	return { relations, models }
}

export const primitivePropertyPattern = /^(integer|float|number|string|bytes|boolean|json)(\??)$/
export const referencePropertyPattern = /^@([a-z0-9.-]+)(\??)$/
export const relationPropertyPattern = /^@([a-z0-9.-]+)\[\]$/

export function parseProperty(modelName: string, propertyName: string, propertyType: PropertyType): Property {
	assert(
		namePattern.test(propertyName),
		`error defining ${modelName}: expected property names to match /^[a-zA-Z0-9$:_\\-\\.]+$/`,
	)

	if (propertyType === "primary") {
		return { name: propertyName, kind: "primary" }
	}

	const primitiveResult = primitivePropertyPattern.exec(propertyType)
	if (primitiveResult !== null) {
		const [_, type, optional] = primitiveResult

		// json field cannot be optional
		if (type === "json" && optional === "?") {
			throw new Error(
				`error defining ${modelName}: field "${propertyName}" is invalid - json fields cannot be optional`,
			)
		}

		return { name: propertyName, kind: "primitive", type: type as PrimitiveType, optional: optional === "?" }
	}

	const referenceResult = referencePropertyPattern.exec(propertyType)
	if (referenceResult !== null) {
		const [_, target, optional] = referenceResult
		return { name: propertyName, kind: "reference", target, optional: optional === "?" }
	}

	const relationResult = relationPropertyPattern.exec(propertyType)
	if (relationResult !== null) {
		const [_, target] = relationResult
		return { name: propertyName, kind: "relation", target: target }
	}

	throw new Error(`error defining ${modelName}: invalid property "${propertyType}"`)
}
