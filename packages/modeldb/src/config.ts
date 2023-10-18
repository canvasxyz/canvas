import { Config, Model, ModelsInit, PrimitiveType, Property, PropertyType, Relation } from "./types.js"
import { assert, namePattern } from "./utils.js"

export function parseConfig(init: ModelsInit): Config {
	const relations: Relation[] = []
	const models: Model[] = []

	for (const [modelName, { $indexes, ...rest }] of Object.entries(init)) {
		assert(namePattern.test(modelName), "expected model name to match /^[a-zA-Z0-9$:_\\-\\.]+$/")

		const indexes: string[][] = []
		const properties: Property[] = []

		for (const [propertyName, propertyType] of Object.entries(rest)) {
			assert(!Array.isArray(propertyType), "invalid property type")
			const property = parseProperty(propertyName, propertyType)

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
		assert(primaryProperties.length === 1, "models must have exactly one `primary` property")

		if ($indexes !== undefined) {
			for (const index of $indexes) {
				if (relations.some((relation) => relation.source === modelName && relation.property === index)) {
					continue
				} else {
					indexes.push(Array.isArray(index) ? index : [index])
				}
			}
		}

		models.push({ name: modelName, properties, indexes })
	}

	return { relations, models }
}

export const primitivePropertyPattern = /^(integer|float|string|bytes)(\??)$/
export const referencePropertyPattern = /^@([a-z0-9.-]+)(\??)$/
export const relationPropertyPattern = /^@([a-z0-9.-]+)\[\]$/

export function parseProperty(propertyName: string, propertyType: PropertyType): Property {
	assert(namePattern.test(propertyName), "expected property name to match /^[a-zA-Z0-9$:_\\-\\.]+$/")

	if (propertyType === "primary") {
		return { name: propertyName, kind: "primary" }
	}

	const primitiveResult = primitivePropertyPattern.exec(propertyType)
	if (primitiveResult !== null) {
		const [_, type, optional] = primitiveResult
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

	throw new Error(`invalid property "${propertyType}"`)
}
