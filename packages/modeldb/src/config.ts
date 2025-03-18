import { assert, deepEqual, signalInvalidType } from "@canvas-js/utils"

import {
	Model,
	ModelInit,
	ModelSchema,
	PrimitiveProperty,
	PrimitiveType,
	Property,
	PropertyType,
	Relation,
} from "./types.js"
import { namePattern } from "./utils.js"

export const primitivePropertyPattern = /^(integer|float|number|string|bytes|boolean|json)(\??)$/
export const referencePropertyPattern = /^@([a-z0-9.-]+)(\??)$/
export const relationPropertyPattern = /^@([a-z0-9.-]+)\[\]$/

export class Config {
	public static baseModels = {
		$models: Config.parseModel("$models", { name: "primary", model: "json" }),
		$versions: Config.parseModel("$versions", {
			$primary: "namespace/version",
			namespace: "string",
			version: "integer",
			timestamp: "string",
		}),
	}

	public static baseConfig = new Config(Object.values(Config.baseModels))

	public static parse(init: ModelSchema, options: { freeze?: boolean } = {}): Config {
		const models: Model[] = Object.values(Config.baseModels)

		for (const [modelName, modelInit] of Object.entries(init)) {
			if (modelName in Config.baseModels) {
				throw new Error(`error parsing model schema - "${modelName}" is a reserved model name`)
			}

			const model = Config.parseModel(modelName, modelInit)
			models.push(model)
		}

		return new Config(models, options)
	}

	private static parseModel(modelName: string, init: ModelInit): Model {
		const { $indexes, $primary, ...rest } = init

		if (!namePattern.test(modelName)) {
			throw new Error(`error defining ${modelName}: expected model name to match /^[a-zA-Z0-9$:_\\-\\.]+$/`)
		}

		const primaryKey = $primary?.split("/") ?? []
		const properties: Record<string, Property> = {}
		const indexes: string[][] = []

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
			const propertyNames = Config.parseIndex(index)
			for (const propertyName of propertyNames) {
				if (properties[propertyName] === undefined) {
					throw new Error(`invalid index "${index}" - property "${propertyName}" does not exist`)
				}

				if (propertyNames.length > 1 && properties[propertyName].kind === "relation") {
					throw new Error(`invalid index "${index}" - cannot mix relation and non-relation properties`)
				}
			}

			indexes.push(propertyNames)
		}

		return { name: modelName, primaryKey, properties: Object.values(properties), indexes }
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

	public static parseIndex = (index: string) => index.split("/")

	public readonly primaryKeys: Record<string, PrimitiveProperty[]>
	public relations: Relation[] = []

	#frozen = false

	public constructor(public models: Model[], options: { freeze?: boolean } = {}) {
		this.primaryKeys = {}
		for (const model of models) {
			this.primaryKeys[model.name] = model.primaryKey.map((name) => {
				const property = model.properties.find((property) => property.name === name)
				assert(property !== undefined, "internal error - failed to find primary property")
				assert(property.kind === "primitive", "error parsing model schema - primary properties must be primitive types")
				assert(
					property.type === "integer" || property.type === "string" || property.type === "bytes",
					"error parsing model schema - primary properties must be integer | string | bytes types",
				)
				assert(property.nullable === false, "error parsing model schema - primary properties cannot be nullable")
				return property
			})

			for (const property of model.properties) {
				if (property.kind === "reference") {
					if (!this.models.some((model) => model.name === property.target)) {
						throw new Error(`invalid reference target - no "${property.target}" model`)
					}
				} else if (property.kind === "relation") {
					if (!this.models.some((model) => model.name === property.target)) {
						throw new Error(`invalid relation target - no "${property.target}" model`)
					}

					this.relations.push({
						source: model.name,
						sourceProperty: property.name,
						target: property.target,
						indexed: model.indexes.some((index) => Config.equalIndex(index, [property.name])),
					})
				}
			}
		}

		if (options.freeze) {
			this.freeze()
		}
	}

	public freeze() {
		assert(this.#frozen === false, "Config already frozen")
		this.#frozen = true
		Object.freeze(this)
		Object.freeze(this.models)
		Object.freeze(this.relations)
		this.models.forEach(Object.freeze)
		this.relations.forEach(Object.freeze)
	}

	public createModel(name: string, init: ModelInit): Model {
		if (this.models.some((model) => model.name === name)) {
			throw new Error(`failed to create model "${name}" - model already exists`)
		}

		const model = Config.parseModel(name, init)
		for (const property of model.properties) {
			if (property.kind === "reference") {
				if (!this.models.some((model) => model.name === property.target)) {
					throw new Error(`failed to create model "${name}" - invalid reference target "${property.target}"`)
				}
			} else if (property.kind === "relation") {
				if (!this.models.some((model) => model.name === property.target)) {
					throw new Error(`failed to create model "${name}" - invalid relation target "${property.target}"`)
				}

				this.relations.push({
					source: model.name,
					sourceProperty: property.name,
					target: property.target,
					indexed: model.indexes.some((index) => Config.equalIndex(index, [property.name])),
				})
			}
		}

		this.primaryKeys[name] = model.primaryKey.map((name) => {
			const property = model.properties.find((property) => property.name === name)
			assert(property !== undefined, "internal error - failed to find primary property")
			assert(property.kind === "primitive", "error parsing model schema - primary properties must be primitive types")
			assert(
				property.type === "integer" || property.type === "string" || property.type === "bytes",
				"error parsing model schema - primary properties must be integer | string | bytes types",
			)
			assert(property.nullable === false, "error parsing model schema - primary properties cannot be nullable")
			return property
		})

		this.models.push(model)
		return model
	}

	public deleteModel(name: string) {
		const model = this.models.find((model) => model.name === name)
		if (model === undefined) {
			throw new Error(`failed to delete model "${name}" - model does not exist`)
		}

		if (this.relations.some((relation) => relation.target === name)) {
			throw new Error(`failed to delete model "${name}" - model is the target of one or more relations`)
		}

		this.models = this.models.filter((model) => model.name !== name)
		this.relations = this.relations.filter((relation) => relation.source !== name)
		delete this.primaryKeys[name]
	}

	public addProperty(modelName: string, propertyName: string, propertyType: PropertyType): Property {
		const model = this.models.find((model) => model.name === modelName)
		if (model === undefined) {
			throw new Error(`failed to add property "${propertyName}" - model "${modelName}" does not exist`)
		}

		if (model.properties.some((property) => property.name === propertyName)) {
			throw new Error(`failed to add property "${propertyName}" - property already exists on model "${modelName}"`)
		}

		const [property, primary] = Config.parseProperty(modelName, propertyName, propertyType)
		if (primary) {
			throw new Error(`failed to add property "${propertyName}" - cannot alter a model's primary key`)
		}

		if (property.kind === "primitive") {
			if (!property.nullable) {
				throw new Error(`failed to add property "${propertyName}" - added properties must be nullable`)
			}
		} else if (property.kind === "reference") {
			if (!property.nullable) {
				throw new Error(`failed to add property "${propertyName}" - added properties must be nullable`)
			}

			if (!this.models.some((model) => model.name === property.target)) {
				throw new Error(`failed to add property "${propertyName}" - invalid reference target "${property.target}"`)
			}
		} else if (property.kind === "relation") {
			if (!this.models.some((model) => model.name === property.target)) {
				throw new Error(`failed to add property "${propertyName}" - invalid relation target "${property.target}"`)
			}

			this.relations.push({ source: modelName, sourceProperty: propertyName, target: property.target, indexed: false })
		} else {
			signalInvalidType(property)
		}

		model.properties.push(property)

		return property
	}

	public removeProperty(modelName: string, propertyName: string) {
		const model = this.models.find((model) => model.name === modelName)
		if (model === undefined) {
			throw new Error(`failed to add property - model "${modelName}" does not exist`)
		}

		const property = model.properties.find((property) => property.name === propertyName)
		if (property === undefined) {
			throw new Error(`failed to remove property - no property "${propertyName}" on model "${modelName}"`)
		}

		if (model.primaryKey.includes(propertyName)) {
			throw new Error(`failed to remove property "${propertyName}" - cannot alter a model's primary key`)
		}

		model.properties = model.properties.filter((property) => property.name !== propertyName)
		if (property.kind === "relation") {
			this.relations = this.relations.filter(
				(relation) => relation.source !== modelName || relation.sourceProperty !== propertyName,
			)
		}
	}

	public addIndex(modelName: string, index: string) {
		const model = this.models.find((model) => model.name === modelName)
		if (model === undefined) {
			throw new Error(`failed to add index "${index}" - model "${modelName}" does not exist`)
		}

		const propertyNames = Config.parseIndex(index)

		if (model.indexes.some((existingIndex) => Config.equalIndex(existingIndex, propertyNames))) {
			throw new Error(`failed to add index "${index}" - index already exists`)
		}

		const properties = propertyNames.map((propertyName) => {
			const property = model.properties.find((property) => property.name === propertyName)
			if (property === undefined) {
				throw new Error(`failed to add index "${index}" - property "${propertyName}" does not exist`)
			}
			return property
		})

		if (properties.length === 1) {
			const [property] = properties
			if (property.kind === "relation") {
				const relation = this.relations.find(
					(relation) => relation.source === modelName && relation.sourceProperty === property.name,
				)

				assert(relation !== undefined, "internal error - expected relation !== undefined")
				if (relation.indexed) {
					throw new Error(`failed to add index "${index}" - index already exists`)
				}

				relation.indexed = true
			}
		} else {
			for (const property of properties) {
				if (property.kind === "relation") {
					throw new Error(`failed to add index "${index}" - cannot mix relation and non-relation properties`)
				}
			}
		}

		model.indexes.push(propertyNames)
		return propertyNames
	}

	public removeIndex(modelName: string, index: string) {
		const model = this.models.find((model) => model.name === modelName)
		if (model === undefined) {
			throw new Error(`failed to remove index - model "${modelName}" does not exist`)
		}

		const propertyNames = Config.parseIndex(index)

		if (model.indexes.every((existingIndex) => !Config.equalIndex(existingIndex, propertyNames))) {
			throw new Error(`failed to remove index "${index}" - index does not exist`)
		}

		if (propertyNames.length === 1) {
			const [propertyName] = propertyNames
			const property = model.properties.find((property) => property.name === propertyName)
			assert(property !== undefined, "internal error - expected property !== undefined")
			if (property.kind === "relation") {
				const relation = this.relations.find(
					(relation) => relation.source === modelName && relation.sourceProperty === propertyName,
				)
				assert(relation !== undefined, "internal error - expected relation !== undefined")
				relation.indexed = false
			}
		}

		if (model.indexes.every((existingIndex) => !Config.equalIndex(existingIndex, propertyNames))) {
			throw new Error(`failed to remove index "${index}" - index does not exist`)
		}

		model.indexes = model.indexes.filter((existingIndex) => !Config.equalIndex(existingIndex, propertyNames))
	}

	public equal(other: Config): boolean {
		for (const thisModel of this.models) {
			const otherModel = other.models.find((model) => model.name === thisModel.name)
			if (otherModel === undefined || !Config.equalModel(thisModel, otherModel)) {
				return false
			}
		}

		for (const thisRelation of this.relations) {
			const otherRelation = other.relations.find(
				(relation) =>
					relation.source === thisRelation.source && relation.sourceProperty === thisRelation.sourceProperty,
			)

			if (otherRelation === undefined || !deepEqual(thisRelation, otherRelation)) {
				return false
			}
		}

		return true
	}

	public static equalModel(a: Model, b: Model): boolean {
		if (a.name !== b.name) {
			return false
		}

		if (!Config.equalIndex(a.primaryKey, b.primaryKey)) {
			return false
		}

		for (const aIndex of a.indexes) {
			if (!b.indexes.some((index) => Config.equalIndex(index, aIndex))) {
				return false
			}
		}

		for (const bIndex of b.indexes) {
			if (!a.indexes.some((index) => Config.equalIndex(index, bIndex))) {
				return false
			}
		}

		for (const aProperty of a.properties) {
			const bProperty = b.properties.find((property) => property.name === aProperty.name)
			if (bProperty === undefined) {
				return false
			}

			if (!deepEqual(aProperty, bProperty)) {
				return false
			}
		}

		for (const bProperty of b.properties) {
			const aProperty = a.properties.find((property) => property.name === bProperty.name)
			if (aProperty === undefined) {
				return false
			}

			if (!deepEqual(bProperty, aProperty)) {
				return false
			}
		}

		return true
	}

	public static equalIndex = (a: string[], b: string[]) => a.length === b.length && a.every((name, i) => name === b[i])

	public static assertEqual(actual: Config, expected: Config) {
		for (const actualModel of actual.models) {
			const expectedModel = expected.models.find((model) => model.name === actualModel.name)
			if (expectedModel === undefined) {
				throw new Error(`conflicting schemas: found extraneous model "${actualModel.name}"`)
			}

			Config.assertEqualModel(actualModel, expectedModel)
		}

		for (const expectedModel of expected.models) {
			const actualModel = actual.models.find((model) => model.name === expectedModel.name)
			if (actualModel === undefined) {
				throw new Error(`conflicting schemas: missing expected model "${expectedModel.name}"`)
			}

			Config.assertEqualModel(actualModel, expectedModel)
		}

		for (const actualRelation of actual.relations) {
			const expectedRelation = expected.relations.find(
				(relation) =>
					relation.source === actualRelation.source && relation.sourceProperty === actualRelation.sourceProperty,
			)

			assert(expectedRelation !== undefined, "internal error - expected expectedRelation !== undefined")
			assert(
				deepEqual(actualRelation, expectedRelation),
				"internal error - expected deepEqual(actualRelation, expectedRelation)",
			)
		}

		for (const expectedRelation of expected.relations) {
			const actualRelation = actual.relations.find(
				(relation) =>
					relation.source === expectedRelation.source && relation.sourceProperty === expectedRelation.sourceProperty,
			)

			assert(actualRelation !== undefined, "internal error - expected actualRelation !== undefined")
			assert(
				deepEqual(actualRelation, expectedRelation),
				"internal error - expected deepEqual(actualRelation, expectedRelation)",
			)
		}
	}

	public static assertEqualModel(actualModel: Model, expectedModel: Model): void {
		if (expectedModel.name !== actualModel.name) {
			throw new Error(`model names not equal - expected "${expectedModel.name}", found "${actualModel.name}"`)
		}

		const name = expectedModel.name

		if (!Config.equalIndex(expectedModel.primaryKey, actualModel.primaryKey)) {
			const expected = expectedModel.primaryKey.join("/")
			const actual = actualModel.primaryKey.join("/")
			throw new Error(`model primary keys not equal - expected ${expected}, found ${actual}`)
		}

		const prefix = `schema conflict in model "${name}"`
		for (const expectedIndex of expectedModel.indexes) {
			if (!actualModel.indexes.some((index) => Config.equalIndex(index, expectedIndex))) {
				throw new Error(`${prefix} - expected index ${expectedIndex.join("/")} not found`)
			}
		}

		for (const actualIndex of actualModel.indexes) {
			if (!expectedModel.indexes.some((index) => Config.equalIndex(index, actualIndex))) {
				throw new Error(`${prefix} - found extraneous index ${actualIndex.join("/")}`)
			}
		}

		for (const expectedProperty of expectedModel.properties) {
			const actualProperty = actualModel.properties.find((property) => property.name === expectedProperty.name)
			if (actualProperty === undefined) {
				throw new Error(`${prefix} - expected property "${expectedProperty.name}" not found`)
			}

			assert(deepEqual(expectedProperty, actualProperty), prefix, { expectedProperty, actualProperty })
		}

		for (const actualProperty of actualModel.properties) {
			const expectedProperty = expectedModel.properties.find((property) => property.name === actualProperty.name)
			if (expectedProperty === undefined) {
				throw new Error(`${prefix} - found extraneous property "${actualProperty.name}"`)
			}

			assert(deepEqual(expectedProperty, actualProperty), prefix, { expectedProperty, actualProperty })
		}
	}
}
