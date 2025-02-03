import { IDBPIndex, IDBPObjectStore, IDBPTransaction } from "idb"
import { logger } from "@libp2p/logger"

import { assert, signalInvalidType } from "@canvas-js/utils"

import {
	Model,
	ModelValue,
	NotExpression,
	Property,
	PropertyValue,
	QueryParams,
	RangeExpression,
	WhereCondition,
	ModelValueWithIncludes,
	IncludeExpression,
	PrimaryKeyValue,
	getFilter,
	isNotExpression,
	isLiteralExpression,
	isRangeExpression,
	validateModelValue,
} from "@canvas-js/modeldb"

import { IDBValue, encodePropertyValue, decodePropertyValue } from "./encoding.js"
import { equalIndex, getIndexName } from "./utils.js"

type ObjectValue = Record<string, IDBValue>

type StoreIndex = IDBPObjectStore<any, any, string, "readonly"> | IDBPIndex<any, any, string, string, "readonly">

export class ModelAPI {
	public readonly storeName: string
	private readonly log: ReturnType<typeof logger>
	private readonly properties: Record<string, Property>

	constructor(readonly model: Model) {
		this.storeName = model.name
		this.log = logger(`canvas:modeldb:[${model.name}]`)
		this.properties = Object.fromEntries(model.properties.map((property) => [property.name, property]))
	}

	private getStore<Mode extends IDBTransactionMode>(txn: IDBPTransaction<any, any, Mode>) {
		return txn.objectStore(this.storeName)
	}

	public async get<Mode extends IDBTransactionMode>(
		txn: IDBPTransaction<any, any, Mode>,
		key: PrimaryKeyValue | PrimaryKeyValue[],
	): Promise<ModelValue | null> {
		const unwrappedKey = Array.isArray(key) && key.length === 1 ? key[0] : key
		const value: ObjectValue | undefined = await this.getStore(txn).get(unwrappedKey)

		if (value === undefined) {
			return null
		} else {
			return this.decodeObject(value)
		}
	}

	public async getMany<Mode extends IDBTransactionMode>(
		txn: IDBPTransaction<any, any, Mode>,
		keys: PrimaryKeyValue[] | PrimaryKeyValue[][],
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

	async delete(txn: IDBPTransaction<any, any, "readwrite">, key: PrimaryKeyValue | PrimaryKeyValue[]): Promise<void> {
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

		const [bestIndex, bestIndexRange, bestIndexCount, exact] = await this.getBestIndex(store, where)
		if (exact) {
			return bestIndexCount
		}

		const filter = getFilter(this.model, where)
		let count = 0
		for await (const {} of this.queryIndex(bestIndex, bestIndexRange, directions.asc, filter)) {
			count++
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
			const api = Object.values(models).find((api) => api.model.name === modelName)
			assert(api !== undefined)

			for (const includeKey of Object.keys(include)) {
				// look up the model corresponding to the { include: key }
				const prop = api.properties[includeKey]
				assert(prop, "include was used with a missing property")
				assert(
					prop.kind === "reference" || prop.kind === "relation",
					"include should only be used with references or relations",
				)
				const includeModelName = prop.target
				const includeModelApi = models[includeModelName]
				const includeModel = includeModelApi.model
				assert(
					includeModel.primaryKey.length === 1,
					"'include' can only be used on models with a single string primary key",
				)
				const [includePrimaryKeyName] = includeModel.primaryKey
				const includePrimaryKeyProperty = includeModelApi.properties[includePrimaryKeyName]
				assert(
					includePrimaryKeyProperty.kind === "primitive" && includePrimaryKeyProperty.type === "string",
					"'include' can only be used on models with a single string primary key",
				)

				cache[includeModelName] ||= {}
				for (const record of records) {
					const includeValue = record[includeKey]

					// Reference type
					if (!Array.isArray(includeValue)) {
						assert(typeof includeValue === "string", "include should only be used with references or relations")
						if (cache[includeModelName][includeValue]) continue

						const [result] = await includeModelApi.query(txn, {
							where: { [includePrimaryKeyName]: includeValue },
						})

						if (result === undefined) {
							console.error(
								`expected reference to be populated while looking up ${modelName}.${includeKey}: ${includeModelName} = ${includeValue}`,
							)
							continue
						}

						cache[includeModelName][includeValue] = { ...result }
						if (include[includeKey]) {
							await populateCache(includeModelName, [result], include[includeKey])
						}
						continue
					}

					// Relation type
					for (const item of includeValue) {
						assert(typeof item === "string", "include should only be used with references or relations")
						if (cache[includeModelName][item]) continue
						const [result] = await models[includeModelName].query(txn, {
							where: { [includePrimaryKeyName]: item },
						})
						if (result === undefined) {
							console.error(
								`expected relation to be populated while looking up ${modelName}.${includeKey}: ${includeModelName} = ${includeValue}`,
							)
							continue
						}
						cache[includeModelName][item] = { ...result }
						if (include[includeKey]) {
							await populateCache(includeModelName, [result], include[includeKey])
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
					const prop = thisModel.properties[includeKey]
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

	private getStoreIndex(store: IDBPObjectStore<any, any, string, "readonly">, index: string[]): StoreIndex | null {
		if (equalIndex(index, this.model.primaryKey)) {
			return store
		}

		if (this.model.indexes.some((i) => equalIndex(index, i))) {
			return store.index(getIndexName(index))
		}

		return null
	}

	private async *queryIndex(
		storeIndex: StoreIndex,
		range: IDBKeyRange | null,
		direction: IDBCursorDirection = "next",
		filter?: (value: ModelValue) => boolean,
	): AsyncIterable<ModelValue> {
		this.log.trace("querying %s: %o %s", storeIndex.name, range, direction)
		for (
			let cursor = await storeIndex.openCursor(range, direction);
			cursor !== null;
			cursor = await cursor.continue()
		) {
			const value = this.decodeObject(cursor.value)
			if (filter === undefined || filter(value)) {
				yield value
			}
		}
	}

	private getSelect(select: Record<string, boolean> | undefined): (value: ModelValue) => ModelValue {
		if (select === undefined) {
			return (value) => value
		}

		const keys = Object.keys(select).filter((key) => select[key])
		return (value) => Object.fromEntries(keys.map((key) => [key, value[key]]))
	}

	private getIndexRange(index: string[], where: WhereCondition): [range: IDBKeyRange | null, exact: boolean] {
		const whereKeys = Object.entries(where)
			.filter(([_, expression]) => expression !== undefined && !isEmpty(expression))
			.map(([propertyName]) => propertyName)

		if (whereKeys.length === 0) {
			return [null, true]
		}

		if (index.length === 1) {
			const exact = whereKeys.length === 1 && whereKeys[0] === index[0]

			const [propertyName] = index
			const property = this.properties[propertyName]

			const expression = where[propertyName]
			if (expression === undefined || isEmpty(expression)) {
				return [null, exact]
			} else if (isLiteralExpression(expression)) {
				return [IDBKeyRange.only(encodePropertyValue(property, expression)), true]
			} else if (isNotExpression(expression)) {
				if (expression.neq === undefined) {
					return [null, exact]
				} else if (expression.neq === null) {
					const range = IDBKeyRange.lowerBound(encodePropertyValue(property, null), true)
					return [range, exact]
				} else {
					// don't use the index; the record filter will still filter out the appropriate records
					return [null, false]
				}
			} else if (isRangeExpression(expression)) {
				const range = getRange(property, expression)
				return [range, exact]
			} else {
				signalInvalidType(expression)
			}
		}

		const exact = whereKeys.length === index.length && whereKeys.every((key) => index.includes(key))

		// For now, we do a simplified version of composite index matching,
		// requiring every index component to have an expression in the where condition.
		// Additionally, only the last component can be a  range expression.
		const prefix = index.slice(0, index.length - 1)
		const tail = index[index.length - 1]

		const values: PropertyValue[] = []

		for (const name of prefix) {
			const expression = where[name]
			if (expression === undefined || isEmpty(expression)) {
				return [null, false]
			} else if (isLiteralExpression(expression)) {
				values.push(expression)
			} else {
				return [null, false]
			}
		}

		const expression = where[tail]
		if (expression === undefined || isEmpty(expression)) {
			return [null, false]
		} else if (isLiteralExpression(expression)) {
			values.push(expression)
			const range = IDBKeyRange.only(values.map((value, i) => encodePropertyValue(this.properties[index[i]], value)))
			return [range, exact]
		} else if (isNotExpression(expression)) {
			return [null, false]
		} else if (isRangeExpression(expression)) {
			const { gt, gte, lt, lte } = expression
			let lowerBound: PropertyValue[]
			let lowerBoundOpen: boolean
			if (gt !== undefined) {
				lowerBound = [...values, gt]
				lowerBoundOpen = true
			} else if (gte !== undefined) {
				lowerBound = [...values, gte]
				lowerBoundOpen = false
			} else {
				return [null, false]
			}

			let upperBound: PropertyValue[]
			let upperBoundOpen: boolean
			if (lt !== undefined) {
				upperBound = [...values, lt]
				upperBoundOpen = true
			} else if (lte !== undefined) {
				upperBound = [...values, lte]
				upperBoundOpen = false
			} else {
				return [null, false]
			}

			const range = IDBKeyRange.bound(
				lowerBound.map((value, i) => encodePropertyValue(this.properties[index[i]], value)),
				upperBound.map((value, i) => encodePropertyValue(this.properties[index[i]], value)),
				lowerBoundOpen,
				upperBoundOpen,
			)

			return [range, exact]
		} else {
			signalInvalidType(expression)
		}
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
			const [[indexName, direction]] = entries
			const index = indexName.split("/")

			const storeIndex = this.getStoreIndex(store, index)
			assert(storeIndex !== null, "orderBy properties must be indexed")

			const [range] = this.getIndexRange(index, where)

			let seen = 0
			let count = 0
			for await (const value of this.queryIndex(storeIndex, range, directions[direction], filter)) {
				if (seen < offset) {
					seen++
					continue
				}

				yield select(value)
				if (++count >= limit) {
					break
				}
			}

			return
		}

		const [bestIndex, bestIndexRange] = await this.getBestIndex(store, where)

		let seen = 0
		let count = 0
		for await (const value of this.queryIndex(bestIndex, bestIndexRange, directions.asc, filter)) {
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

	/**
	 * use to pre-filter results before performing a table scan
	 * by choosing the index that has the fewest matching entries
	 */
	private async getBestIndex(
		store: IDBPObjectStore<any, any, string, "readonly">,
		where: WhereCondition,
	): Promise<[storeIndex: StoreIndex, indexRange: IDBKeyRange | null, indexCount: number, exact: boolean]> {
		let bestIndex: StoreIndex = store
		let bestIndexRange: IDBKeyRange | null = null
		let bestIndexCount = Infinity
		let bestIndexExact: boolean

		{
			const [indexRange, exact] = this.getIndexRange(this.model.primaryKey, where)
			bestIndexRange = indexRange
			bestIndexExact = exact
			bestIndexCount = await bestIndex.count(bestIndexRange)
		}

		for (const index of this.model.indexes) {
			const [indexRange, exact] = this.getIndexRange(index, where)
			if (indexRange === null) {
				continue
			}

			const storeIndex = this.getStoreIndex(store, index)!
			const indexCount = await storeIndex.count(indexRange)
			if (indexCount < bestIndexCount) {
				bestIndex = storeIndex
				bestIndexRange = indexRange
				bestIndexCount = indexCount
				bestIndexExact = exact
			}
		}

		return [bestIndex, bestIndexRange, bestIndexCount, bestIndexExact]
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
