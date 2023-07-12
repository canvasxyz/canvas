import { Config, Model, ModelsInit, Property, PropertyType, Relation } from "./types.js"

export function parseConfig(init: ModelsInit): Config {
	const relations: Relation[] = []
	const models: Model[] = []

	for (const [modelName, { $type, $indexes, ...rest }] of Object.entries(init)) {
		const indexes: string[][] = []
		const properties: Property[] = []

		for (const [propertyName, propertyType] of Object.entries(rest)) {
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

		if ($indexes !== undefined) {
			for (const index of $indexes) {
				if (relations.some((relation) => relation.source === modelName && relation.property === index)) {
					continue
				} else {
					indexes.push(Array.isArray(index) ? index : [index])
				}
			}
		}

		const kind = $type ?? "immutable"
		models.push({ name: modelName, kind, properties, indexes })
	}

	return { relations, models }
}

const primitivePropertyPattern = /^(integer|float|string|bytes)(\??)$/
const referencePropertyPattern = /^@([a-z0-9\.\-]+)(\??)$/
const relationPropertyPattern = /^@([a-z0-9\.\-]+)\[\]$/

function parseProperty(propertyName: string, propertyType: PropertyType): Property {
	const primitiveResult = primitivePropertyPattern.exec(propertyType)
	if (primitiveResult !== null) {
		const [_, type, optional] = primitiveResult
		return { name: propertyName, kind: "primitive", type, optional: optional === "?" }
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

	throw new Error("invalid property")
}
