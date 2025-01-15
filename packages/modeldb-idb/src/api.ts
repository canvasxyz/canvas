import { IDBPIndex, IDBPObjectStore, IDBPTransaction } from "idb"
import { logger } from "@libp2p/logger"
import * as json from "@ipld/dag-json"

import { assert, signalInvalidType } from "@canvas-js/utils"

import {
	Model,
	ModelValue,
	NotExpression,
	Property,
	PropertyValue,
	QueryParams,
	RangeExpression,
	getCompare,
	getFilter,
	isNotExpression,
	isLiteralExpression,
	isRangeExpression,
	validateModelValue,
	WhereCondition,
	ModelValueWithIncludes,
	IncludeExpression,
	PrimitiveValue,
} from "@canvas-js/modeldb"

import { getIndexName } from "./utils.js"

type ObjectPropertyValue = PropertyValue | PropertyValue[]

type ObjectValue = Record<string, ObjectPropertyValue>

type IndexExpression = PropertyValue | NotExpression | RangeExpression

type CompositePropertyValue = PropertyValue[]
type CompositeNotExpression = { neq: PropertyValue[] | undefined }
type CompositeRangeExpression = {
	gt?: PrimitiveValue[]
	gte?: PrimitiveValue[]
	lt?: PrimitiveValue[]
	lte?: PrimitiveValue[]
}

type CompositeIndexExpression = CompositePropertyValue | CompositeNotExpression | CompositeRangeExpression

export class ModelAPI {
	public readonly storeName: string
	private readonly log: ReturnType<typeof logger>

	constructor(readonly model: Model) {
		this.storeName = model.name
		this.log = logger(`canvas:modeldb:[${model.name}]`)
	}

	private getStore<Mode extends IDBTransactionMode>(txn: IDBPTransaction<any, any, Mode>) {
		return txn.objectStore(this.storeName)
	}

	public async get<Mode extends IDBTransactionMode>(
		txn: IDBPTransaction<any, any, Mode>,
		key: string,
	): Promise<ModelValue | null> {
		const value: ObjectValue | undefined = await this.getStore(txn).get(key)
		if (value === undefined) {
			return null
		} else {
			return this.decodeObject(value)
		}
	}

	public async getMany<Mode extends IDBTransactionMode>(
		txn: IDBPTransaction<any, any, Mode>,
		keys: string[],
	): Promise<(ModelValue | null)[]> {
		// TODO: if keys are near each other, we could try using a range instead of getting each key individually
		const results = []
		for (const key of keys) {
			results.push(await this.get(txn, key))
		}
		return results
	}

	async set(txn: IDBPTransaction<any, any, "readwrite">, value: ModelValue): Promise<void> {
		validateModelValue(this.model, value)
		const object = this.encodeObject(value)
		await this.getStore(txn).put(object)
	}

	async delete(txn: IDBPTransaction<any, any, "readwrite">, key: string): Promise<void> {
		await this.getStore(txn).delete(key)
	}

	async clear(txn: IDBPTransaction<any, any, "readwrite">) {
		await this.getStore(txn).clear()
	}

	async count(txn: IDBPTransaction<any, any, IDBTransactionMode>, where: WhereCondition = {}): Promise<number> {
		const store = this.getStore(txn)

		if (Object.keys(where).length === 0) {
			return store.count()
		}

		// try to find an index over one of the properties in the where clause
		// we can use this to "pre-filter" the results before performing a "table scan"
		// choose the index that has the fewest matching entries
		let bestIndex = null
		let bestIndexCount = Infinity
		for (const [property, expression] of Object.entries(where)) {
			const modelProperty = this.model.properties.find((modelProperty) => modelProperty.name === property)
			assert(modelProperty !== undefined, "model property does not exist")

			if (modelProperty.kind === "primitive" && modelProperty.type === "json") {
				throw new Error("json properties are not supported in where clauses")
			}

			if (expression === undefined) {
				continue
			}

			const index = this.getIndex(store, modelProperty)
			if (index === null) {
				continue
			}

			const indexCount = await this.countIndex(property, index, expression)
			if (indexCount < bestIndexCount) {
				bestIndex = index
				bestIndexCount = indexCount
			}
		}

		// if our where clause has only one condition and it has an index, then just return the
		// count from that index
		if (Object.keys(where).length === 1 && bestIndex) {
			return bestIndexCount
		}

		// otherwise iterate over all of the entries and count the ones that match the other conditions
		const entriesToScan = bestIndex ? bestIndex.iterate() : store.iterate()
		const filter = getFilter(this.model, where)
		let count = 0
		for await (const { value } of entriesToScan) {
			if (filter(value)) count++
		}

		return count
	}

	async query(txn: IDBPTransaction<any, any, IDBTransactionMode>, query: QueryParams): Promise<ModelValue[]> {
		const results: ModelValue[] = []
		for await (const value of this.iterate(txn, query)) {
			results.push(value)
		}
		return results
	}

	async queryWithInclude(
		txn: IDBPTransaction<any, any, IDBTransactionMode>,
		models: Record<string, ModelAPI>,
		query: QueryParams,
	): Promise<ModelValueWithIncludes[]> {
		const cache: Record<string, Record<string, ModelValue>> = {} // { [table]: { [id]: ModelValue } }

		const { include, ...rootQuery } = query
		const modelValues = (await this.query(txn, rootQuery)) as ModelValueWithIncludes[]

		// Two-pass recursive query to populate includes. The first pass populates
		// the cache with all models in the response, but doesn't join any of them.
		// The second pass populates includes for every reference/relation,
		// updating the result record in-place.
		//
		// This is necessary because making joins in the first pass would cause the
		// the `include` to be applied everywhere that model appears in the query,
		// but we only want it in the exact places the user has asked for it.
		const populateCache = async (modelName: string, records: ModelValueWithIncludes[], include: IncludeExpression) => {
			const thisModel = Object.values(models).find((api) => api.model.name === modelName)
			assert(thisModel !== undefined)

			for (const includeKey of Object.keys(include)) {
				// look up the model corresponding to the { include: key }
				const prop = thisModel.model.properties.find((prop) => prop.name === includeKey)
				assert(prop, "include was used with a missing property")
				assert(
					prop.kind === "reference" || prop.kind === "relation",
					"include should only be used with references or relations",
				)
				const includeModel = prop.target

				cache[includeModel] ||= {}
				for (const record of records) {
					const includeValue = record[includeKey]
					// Reference type
					if (!Array.isArray(includeValue)) {
						assert(typeof includeValue === "string", "include should only be used with references or relations")
						if (cache[includeModel][includeValue]) continue

						const [result] = await models[includeModel].query(txn, {
							where: { [models[includeModel].model.primaryKey]: includeValue },
						})
						if (result === undefined) {
							console.error(
								`expected reference to be populated while looking up ${modelName}.${includeKey}: ${includeModel} = ${includeValue}`,
							)
							continue
						}
						cache[includeModel][includeValue] = { ...result }
						if (include[includeKey]) {
							await populateCache(includeModel, [result], include[includeKey])
						}
						continue
					}
					// Relation type
					for (const item of includeValue) {
						assert(typeof item === "string", "include should only be used with references or relations")
						if (cache[includeModel][item]) continue
						const [result] = await models[includeModel].query(txn, {
							where: { [models[includeModel].model.primaryKey]: item },
						})
						if (result === undefined) {
							console.error(
								`expected relation to be populated while looking up ${modelName}.${includeKey}: ${includeModel} = ${includeValue}`,
							)
							continue
						}
						cache[includeModel][item] = { ...result }
						if (include[includeKey]) {
							await populateCache(includeModel, [result], include[includeKey])
						}
					}
				}
			}
		}
		const populateRecords = async (
			modelName: string,
			records: ModelValueWithIncludes[],
			include: IncludeExpression,
		) => {
			if (Object.keys(include).length === 0) return

			const thisModel = Object.values(models).find((api) => api.model.name === modelName)
			assert(thisModel !== undefined)

			for (const record of records) {
				for (const includeKey of Object.keys(include)) {
					// look up the model corresponding to the { include: key }
					const prop = thisModel.model.properties.find((prop) => prop.name === includeKey)
					assert(prop, "include was used with a missing property")
					assert(
						prop.kind === "reference" || prop.kind === "relation",
						"include should only be used with references or relations",
					)
					const includeModel = prop.target

					const includeValue = record[includeKey]
					if (!Array.isArray(includeValue)) {
						// Reference type
						if (includeValue === undefined) {
							record[includeKey] = null
							continue
						}
						assert(typeof includeValue === "string", "expected reference to be a string")
						record[includeKey] = { ...cache[includeModel][includeValue] } // replace propertyValue
						if (include[includeKey]) {
							await populateRecords(includeModel, [record[includeKey]], include[includeKey])
						}
					} else {
						// Relation type
						if (includeValue === undefined) {
							record[includeKey] = []
							continue
						}
						record[includeKey] = includeValue.map((pk) => {
							assert(typeof pk === "string", "expected relation to be a string[]")
							return { ...cache[includeModel][pk] }
						}) // replace propertyValue
						if (include[includeKey]) {
							await populateRecords(includeModel, record[includeKey], include[includeKey])
						}
					}
				}
			}
		}
		await populateCache(this.model.name, modelValues, query.include ?? {})
		await populateRecords(this.model.name, modelValues, query.include ?? {})
		return modelValues
	}

	private getIndex(
		store: IDBPObjectStore<any, any, string, "readonly">,
		property: Property,
	): IDBPObjectStore<any, any, string, "readonly"> | IDBPIndex<any, any, string, string, "readonly"> | null {
		if (property.kind === "primary") {
			return store
		}

		const index = this.model.indexes.find((index) => index[0] === property.name)
		if (index === undefined) {
			return null
		}

		return store.index(getIndexName(index))
	}

	private async countIndex(
		propertyName: string,
		storeIndex: IDBPObjectStore<any, any, string, "readonly"> | IDBPIndex<any, any, string, string, "readonly">,
		expression: PropertyValue | NotExpression | RangeExpression | null,
	): Promise<number> {
		const property = this.model.properties.find((property) => property.name === propertyName)
		assert(property !== undefined, "property not found")

		if (isLiteralExpression(expression)) {
			// Here we iterate over the index using an `only` key range
			const range = IDBKeyRange.only(encodePropertyValue(property, expression))
			return await storeIndex.count(range)
		} else if (isNotExpression(expression)) {
			// Here we iterate over the undex using an open `upperBound` key range
			// followed by an open `lowerBound` key range. Unnecessary if expression.neq === null.

			const keyRange =
				expression.neq === undefined
					? null
					: expression.neq === null
					? IDBKeyRange.lowerBound(encodePropertyValue(property, null), true)
					: IDBKeyRange.upperBound(encodePropertyValue(property, expression.neq), true)

			return await storeIndex.count(keyRange)
		} else if (isRangeExpression(expression)) {
			const range = getRange(property, expression)
			return await storeIndex.count(range)
		} else {
			signalInvalidType(expression)
		}
	}

	private async *queryIndex(
		index: string | string[],
		storeIndex: IDBPObjectStore<any, any, string, "readonly"> | IDBPIndex<any, any, string, string, "readonly">,
		expression: IndexExpression,
		direction: IDBCursorDirection = "next",
	): AsyncIterable<ModelValue> {
		const property = this.model.properties.find((property) => property.name === index)
		assert(property !== undefined, "property not found")

		if (expression === null) {
			// Here we iterate over the entire index
			for (
				let cursor = await storeIndex.openCursor(null, direction);
				cursor !== null;
				cursor = await cursor.continue()
			) {
				yield this.decodeObject(cursor.value)
			}
		} else if (isLiteralExpression(expression)) {
			// Here we iterate over the index using an `only` key range
			const range = IDBKeyRange.only(encodePropertyValue(property, expression))
			for (
				let cursor = await storeIndex.openCursor(range, direction);
				cursor !== null;
				cursor = await cursor.continue()
			) {
				yield this.decodeObject(cursor.value)
			}
		} else if (isNotExpression(expression)) {
			// Here we iterate over the undex using an open `upperBound` key range
			// followed by an open `lowerBound` key range. Unnecessary if expression.neq === null.

			const keyRange =
				expression.neq === undefined
					? null
					: expression.neq === null
					? IDBKeyRange.lowerBound(encodePropertyValue(property, null), true)
					: IDBKeyRange.upperBound(encodePropertyValue(property, expression.neq), true)

			for (
				let cursor = await storeIndex.openCursor(keyRange, direction);
				cursor !== null;
				cursor = await cursor.continue()
			) {
				yield this.decodeObject(cursor.value)
			}
		} else if (isRangeExpression(expression)) {
			const range = getRange(property, expression)
			for (
				let cursor = await storeIndex.openCursor(range, direction);
				cursor !== null;
				cursor = await cursor.continue()
			) {
				yield this.decodeObject(cursor.value)
			}
		} else {
			signalInvalidType(expression)
		}
	}

	private getSelect(select: Record<string, boolean> | undefined): (value: ModelValue) => ModelValue {
		if (select === undefined) {
			return (value) => value
		}

		const keys = Object.keys(select).filter((key) => select[key])
		return (value) => Object.fromEntries(keys.map((key) => [key, value[key]]))
	}

	public async *iterate(
		txn: IDBPTransaction<any, any, IDBTransactionMode>,
		query: QueryParams = {},
	): AsyncIterable<ModelValue> {
		// TODO: re-open the transaction if the caller awaits on other promises between yields

		const select = this.getSelect(query.select)
		const filter = getFilter(this.model, query.where)
		const store = this.getStore(txn)

		const limit = query.limit ?? Infinity
		const offset = query.offset ?? 0
		const where = query.where ?? {}

		if (query.orderBy !== undefined) {
			const entries = Object.entries(query.orderBy)
			assert(entries.length === 1, "expected exactly one entry in query.orderBy")
			const [[property, direction]] = entries
			const modelProperty = this.model.properties.find((modelProperty) => modelProperty.name === property)
			assert(modelProperty !== undefined, "model property does not exist")

			const index = this.getIndex(store, modelProperty)
			assert(index !== null, "orderBy property must be indexed")

			let seen = 0
			let count = 0
			for await (const value of this.queryIndex(property, index, where[property] ?? null, directions[direction])) {
				if (filter(value)) {
					if (seen < offset) {
						seen++
						continue
					}

					yield select(value)
					if (++count >= limit) {
						break
					}
				}
			}

			return
		}

		// try to find an index over one of the properties in the where clause
		// we can use this to "pre-filter" the results before performing a "table scan"
		// choose the index that has the fewest matching entries
		let bestIndex = null
		let bestIndexProperty = null
		let bestIndexCount = Infinity
		for (const [property, expression] of Object.entries(where)) {
			const modelProperty = this.model.properties.find((modelProperty) => modelProperty.name === property)
			assert(modelProperty !== undefined, "model property does not exist")

			if (modelProperty.kind === "primitive" && modelProperty.type === "json") {
				throw new Error("json properties are not supported in where clauses")
			}

			if (expression === undefined || isEmpty(expression)) {
				continue
			}

			const index = this.getIndex(store, modelProperty)
			if (index === null) {
				continue
			}

			const indexCount = await this.countIndex(property, index, expression)
			if (indexCount < bestIndexCount) {
				bestIndex = index
				bestIndexProperty = property
				bestIndexCount = indexCount
			}
		}

		if (bestIndex !== null && bestIndexProperty !== null) {
			const expression = where[bestIndexProperty]!

			// TODO: we could be smarter about this if `orderBy` & `limit` are both provided.

			let seen = 0
			let count = 0
			for await (const value of this.queryIndex(bestIndexProperty, bestIndex, expression)) {
				if (filter(value)) {
					if (seen < offset) {
						seen++
						continue
					}

					yield select(value)
					if (++count >= limit) {
						break
					}
				}
			}

			return
		}

		let seen = 0
		let count = 0
		for (let cursor = await store.openCursor(); cursor !== null; cursor = await cursor.continue()) {
			const key = cursor.key
			assert(typeof key === "string", "internal error - unexpected cursor key")
			const value = this.decodeObject(cursor.value)
			if (filter(value)) {
				if (seen < offset) {
					seen++
					continue
				}

				yield select(value)
				if (++count >= limit) {
					break
				}
			}
		}
	}

	private encodeObject(value: ModelValue): ObjectValue {
		const object: ObjectValue = {}
		for (const property of this.model.properties) {
			object[property.name] = encodePropertyValue(property, value[property.name])
		}

		return object
	}

	private decodeObject(object: ObjectValue): ModelValue {
		const value: ModelValue = {}
		for (const property of this.model.properties) {
			if (object[property.name] === undefined || object[property.name] === null) {
				value[property.name] = null
				continue
			}
			value[property.name] = decodePropertyValue(property, object[property.name])
		}

		return value
	}
}

function encodePropertyValue(property: Property, propertyValue: PropertyValue): PropertyValue | PropertyValue[] {
	if (property.kind === "primary") {
		return propertyValue
	} else if (property.kind === "primitive") {
		if (property.nullable) {
			assert(property.type !== "json")
			return propertyValue === null ? [] : [propertyValue]
		} else if (property.type === "json") {
			return json.stringify(propertyValue)
		} else {
			return propertyValue
		}
	} else if (property.kind === "reference") {
		if (property.nullable) {
			return propertyValue === null ? [] : [propertyValue]
		} else {
			return propertyValue
		}
	} else if (property.kind === "relation") {
		return propertyValue
	} else {
		signalInvalidType(property)
	}
}

function decodePropertyValue(property: Property, objectPropertyValue: PropertyValue | PropertyValue[]): PropertyValue {
	if (property.kind === "primary") {
		assert(typeof objectPropertyValue === "string", 'expected objectPropertyValue === "string"')
		return objectPropertyValue
	} else if (property.kind === "primitive") {
		if (property.nullable) {
			assert(property.type !== "json")
			assert(Array.isArray(objectPropertyValue))
			return objectPropertyValue.length === 0 ? null : objectPropertyValue[0]
		} else if (property.type === "json") {
			assert(typeof objectPropertyValue === "string")
			return json.parse(objectPropertyValue)
		} else {
			assert(!Array.isArray(objectPropertyValue))
			return objectPropertyValue
		}
	} else if (property.kind === "reference") {
		if (property.nullable) {
			assert(Array.isArray(objectPropertyValue))
			return objectPropertyValue.length === 0 ? null : objectPropertyValue[0]
		} else {
			assert(!Array.isArray(objectPropertyValue))
			return objectPropertyValue
		}
	} else if (property.kind === "relation") {
		return objectPropertyValue as string[]
	} else {
		signalInvalidType(property)
	}
}

const directions = { asc: "next", desc: "prev" } as const

function getRange(property: Property, { gt, gte, lt, lte }: RangeExpression): IDBKeyRange | null {
	const lower = gt !== undefined ? gt : gte !== undefined ? gte : undefined
	const upper = lt !== undefined ? lt : lte !== undefined ? lt : undefined

	if (lower !== undefined && upper !== undefined) {
		return IDBKeyRange.bound(encodePropertyValue(property, lower), upper, gt !== undefined, lt !== undefined)
	} else if (lower !== undefined) {
		return IDBKeyRange.lowerBound(encodePropertyValue(property, lower), gt !== undefined)
	} else if (upper !== undefined) {
		return IDBKeyRange.upperBound(encodePropertyValue(property, upper), lt !== undefined)
	} else {
		return null
	}
}

function isEmpty(expr: PropertyValue | NotExpression | RangeExpression): boolean {
	if (isLiteralExpression(expr)) {
		return false
	} else if ("neq" in expr) {
		return expr.neq === undefined
	} else {
		return expr.gte === undefined && expr.gt !== undefined && expr.lte !== undefined && expr.lt !== undefined
	}
}
