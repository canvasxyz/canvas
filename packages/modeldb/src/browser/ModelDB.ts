import { IDBPDatabase, IDBPIndex, IDBPTransaction, openDB } from "idb"

import { logger } from "@libp2p/logger"
import { equals } from "multiformats/bytes"
import { lessThan } from "@canvas-js/okra"

import { AbstractModelDB, ModelDBOptions } from "../AbstractModelDB.js"

import {
	Config,
	Context,
	Effect,
	Model,
	ModelValue,
	ModelsInit,
	NotExpression,
	PrimitiveProperty,
	PrimitiveType,
	Property,
	PropertyValue,
	QueryParams,
	RangeExpression,
	ReferenceProperty,
	RelationProperty,
	Resolver,
	WhereCondition,
} from "../types.js"

import { parseConfig } from "../config.js"

import {
	assert,
	signalInvalidType,
	isNotExpression,
	isLiteralExpression,
	isRangeExpression,
	validateModelValue,
	validatePropertyValue,
} from "../utils.js"

const getObjectStoreName = (model: string) => `record/${model}`
const getTombstoneObjectStoreName = (model: string) => `tombstone/${model}`
const getIndexName = (index: string[]) => index.join("/")

export class ModelDB extends AbstractModelDB {
	public static async initialize(name: string, models: ModelsInit, options: ModelDBOptions = {}) {
		const config = parseConfig(models)
		const db = await openDB(name, 1, {
			upgrade(db: IDBPDatabase<unknown>) {
				// create object stores
				for (const model of config.models) {
					const recordObjectStore = db.createObjectStore(getObjectStoreName(model.name))
					db.createObjectStore(getTombstoneObjectStoreName(model.name))

					for (const index of model.indexes) {
						if (index.length > 1) {
							// TODO: we can support these by adding synthetic values to every object
							throw new Error("multi-property indexes not supported yet")
						}

						const [property] = index
						recordObjectStore.createIndex(getIndexName(index), property)
					}
				}
			},
		})

		return new ModelDB(db, config, options)
	}

	private readonly log = logger("canvas:modeldb")
	readonly #models: Record<string, ModelAPI> = {}

	private constructor(public readonly db: IDBPDatabase, config: Config, options: ModelDBOptions) {
		super(config, options)

		for (const model of config.models) {
			this.#models[model.name] = new ModelAPI(model, this.resolver)
		}
	}

	private async withAsyncTransaction<Mode extends IDBTransactionMode, T>(
		mode: Mode,
		fn: (txn: IDBPTransaction<any, any, Mode>) => Promise<T>
	): Promise<T> {
		let txn: IDBPTransaction<any, any, Mode> | null = null

		try {
			txn = this.db.transaction(this.db.objectStoreNames, mode)
			// we have to use Promise.all here, not sure why this works
			// otherwise we get an unthrowable AbortError
			// it might be because if a transaction fails, idb doesn't know if there are any
			// more database operations that would have been performed in the transaction
			// this is just a post hoc rationalisation though
			// https://github.com/jakearchibald/idb/issues/256#issuecomment-1048551626
			const [res, _] = await Promise.all([fn(txn), txn.done])
			return res
		} catch (e) {
			txn?.abort()
			throw e
		}
	}

	public async *iterate(
		modelName: string
	): AsyncIterable<[key: string, value: ModelValue, version: Uint8Array | null]> {
		const api = this.#models[modelName]
		assert(api !== undefined, "model not found")

		// TODO: re-open the transaction if the caller awaits on other promises between yields

		const storeName = getObjectStoreName(modelName)
		const txn = this.db.transaction([storeName], "readonly", {})
		const store = txn.objectStore(storeName)
		for (let cursor = await store.openCursor(); cursor !== null; cursor = await cursor.continue()) {
			const key = cursor.key
			assert(typeof key === "string", "internal error - unexpected cursor key")
			yield [key, api.decodeObject(cursor.value), cursor.value._version]
		}
	}

	public async get(modelName: string, key: string): Promise<ModelValue | null> {
		const api = this.#models[modelName]
		assert(api !== undefined, "model not found")

		const value: ObjectValue | undefined = await this.db.get(getObjectStoreName(modelName), key)
		if (value === undefined) {
			return null
		} else {
			return api.decodeObject(value)
		}
	}

	public async query(modelName: string, query: QueryParams): Promise<ModelValue[]> {
		const api = this.#models[modelName]
		assert(api !== undefined, "model API not found")
		return await this.withAsyncTransaction("readonly", (txn) => api.query(txn, query))
	}

	public async count(modelName: string): Promise<number> {
		assert(this.models[modelName] !== undefined, "model not found")
		return await this.db.count(getObjectStoreName(modelName))
	}

	public async apply(context: Context, effects: Effect[]): Promise<void> {
		await this.withAsyncTransaction("readwrite", async (txn) => {
			for (const effect of effects) {
				const api = this.#models[effect.model]
				assert(api !== undefined, `model ${effect.model} not found`)
				if (effect.operation === "set") {
					await api.set(txn, context, effect.key, effect.value)
				} else if (effect.operation === "delete") {
					await api.delete(txn, context, effect.key)
				} else {
					signalInvalidType(effect)
				}
			}
		})
	}

	async close() {
		this.db.close()
	}
}

type ObjectPropertyValue = PropertyValue | PropertyValue[]

type ObjectValue = Record<string, ObjectPropertyValue> & { _version: Uint8Array | null }

type Tombstone = { _version: Uint8Array }

class ModelAPI {
	private readonly log = logger(`canvas:modeldb:${this.model.name}`)
	constructor(readonly model: Model, readonly resolver: Resolver) {}

	private getStore<Mode extends IDBTransactionMode>(txn: IDBPTransaction<any, any, Mode>) {
		return txn.objectStore(getObjectStoreName(this.model.name))
	}

	// private getIndex<Mode extends IDBTransactionMode>(txn: IDBPTransaction<any, any, Mode>, index: string[]) {
	// 	return this.getStore(txn).index(getIndexName(index))
	// }

	private getTombstoneStore<Mode extends IDBTransactionMode>(txn: IDBPTransaction<any, any, Mode>) {
		return txn.objectStore(getTombstoneObjectStoreName(this.model.name))
	}

	async set(
		txn: IDBPTransaction<any, any, "readwrite">,
		context: { version: Uint8Array | null },
		key: string,
		value: ModelValue
	): Promise<void> {
		validateModelValue(this.model, value)

		const [store, tombstoneStore] = [this.getStore(txn), this.getTombstoneStore(txn)]

		// no-op if an existing value takes precedence
		const existingValue: ObjectValue | undefined = await store.get(key)
		if (existingValue !== undefined && this.resolver.lessThan(context, { version: existingValue._version })) {
			return
		}

		// no-op if an existing tombstone takes precedence
		const existingTombstone: Tombstone | undefined = await tombstoneStore.get(key)
		if (existingTombstone !== undefined && this.resolver.lessThan(context, { version: existingTombstone._version })) {
			return
		}

		// delete the tombstone since we're about to set the value
		if (existingTombstone !== undefined) {
			await tombstoneStore.delete(key)
		}

		await store.put(this.encodeObject(value, context.version), key)
	}

	async delete(txn: IDBPTransaction<any, any, "readwrite">, context: Context, key: string): Promise<void> {
		const [store, tombstoneStore] = [this.getStore(txn), this.getTombstoneStore(txn)]

		// no-op if an existing value takes precedence
		const existingValue: ObjectValue | undefined = await store.get(key)
		if (existingValue !== undefined && this.resolver.lessThan(context, { version: existingValue._version })) {
			return
		}

		// no-op if an existing tombstone takes precedence
		const existingTombstone: Tombstone | undefined = await tombstoneStore.get(key)
		if (existingTombstone !== undefined && this.resolver.lessThan(context, { version: existingTombstone._version })) {
			return
		}

		if (context.version !== null) {
			await tombstoneStore.put({ _version: context.version }, key)
		}

		await store.delete(key)
	}

	async query(txn: IDBPTransaction<any, any, "readonly">, query: QueryParams): Promise<ModelValue[]> {
		this.log("query %o", query)

		// We can use indexes in two ways: to sort for `orderBy`,
		// or also to filter `where` clauses on indexed properties.
		// If the query has both `where` and `orderBy` clauses, we would
		// ideally use some heuristics to decide which takes priority,
		// which is typically the job of the query planner.
		// For now, we'll let `where` clauses take precedence.

		const limit = query.limit ?? Infinity
		if (limit === 0) {
			return []
		}

		const select = this.getSelect(query.select)
		const filter = this.getFilter(query.where)
		const store = this.getStore(txn)

		if (query.where !== undefined) {
			// We're limited to single-property indexes for the moment,
			// so we just look at the entries of the `where` expression,
			// and if any of them are indexed then we open a cursor on that index.
			// When we support multi-property indexes, we'll want to select the "best"
			// index that matches the most number of properties with `where` clauses.

			// TODO: support multi-property indexes
			for (const [property, expression] of Object.entries(query.where)) {
				const index = this.model.indexes.find((index) => index[0] === property)
				if (index === undefined) {
					continue
				}

				this.log("using index %o", index)

				const storeIndex = store.index(getIndexName(index))

				// TODO: we could be smarter about this if `orderBy` & `limit` are both provided.
				// TODO: grow the array with insertion sort, max capacity of `limit`
				const results: ModelValue[] = []
				for await (const value of this.queryIndex(property, storeIndex, expression)) {
					if (filter(value)) {
						results.push(value)
					}
				}

				if (query.orderBy !== undefined) {
					results.sort(this.getCompare(query.orderBy))
				}

				return results.slice(0, limit).map(select)
			}
		}

		if (query.orderBy !== undefined) {
			const entries = Object.entries(query.orderBy)
			assert(entries.length === 1, "expected exactly one entry in query.orderBy")
			const [[property, direction]] = entries
			const index = this.model.indexes.find((index) => index[0] === property)
			if (index !== undefined) {
				const storeIndex = store.index(getIndexName(index))
				this.log("querying index %s with direction %s", storeIndex.name, direction)

				const results: ModelValue[] = []
				for (
					let cursor = await storeIndex.openCursor(null, directions[direction]);
					cursor !== null;
					cursor = await cursor.continue()
				) {
					const value = this.decodeObject(cursor.value)
					this.log("got cursor entry [%s, %o]", cursor.key, value)
					if (filter(value)) {
						const count = results.push(select(value))
						if (count >= limit) {
							break
						}
					}
				}

				return results
			}
		}

		// Neither `where` no `orderBy` matched existing indexes, so we just iterate over everything
		this.log("iterating over all objects")
		const results: ModelValue[] = []
		for (let cursor = await store.openCursor(); cursor !== null; cursor = await cursor.continue()) {
			const value = this.decodeObject(cursor.value)
			this.log("got cursor entry [%s, %o]", cursor.key, value)
			if (filter(value)) {
				results.push(value)
			}
		}

		if (query.orderBy !== undefined) {
			results.sort(this.getCompare(query.orderBy))
		}

		return results.slice(0, limit).map(select)
	}

	private async *queryIndex(
		propertyName: string,
		storeIndex: IDBPIndex<any, any, string, string, "readonly">,
		expression: PropertyValue | NotExpression | RangeExpression
	): AsyncIterable<ModelValue> {
		const property = this.model.properties.find((property) => property.name === propertyName)
		assert(property !== undefined, "property not found")

		this.log("querying index %s with expression %o", storeIndex.name, expression)
		if (isLiteralExpression(expression)) {
			// Here we iterate over the index using an `only` key range
			const range = IDBKeyRange.only(encodePropertyValue(property, expression))
			this.log("iterating over range IDBKeyRange.only(%o)", expression)
			for (let cursor = await storeIndex.openCursor(range); cursor !== null; cursor = await cursor.continue()) {
				yield this.decodeObject(cursor.value)
			}
		} else if (isNotExpression(expression)) {
			// Here we iterate over the undex using an open `upperBound` key range
			// followed by an open `lowerBound` key range. Unnecessary if expression.neq === null.
			if (expression.neq !== null) {
				this.log("iterating over range IDBKeyRange.upperBound(%o, true)", expression.neq)
				const upper = IDBKeyRange.upperBound(encodePropertyValue(property, expression.neq), true)
				for (let cursor = await storeIndex.openCursor(upper); cursor !== null; cursor = await cursor.continue()) {
					yield this.decodeObject(cursor.value)
				}
			}

			this.log("iterating over range IDBKeyRange.lowerBound(%o, true)", expression.neq)
			const lower = IDBKeyRange.lowerBound(encodePropertyValue(property, expression.neq), true)
			for (let cursor = await storeIndex.openCursor(lower); cursor !== null; cursor = await cursor.continue()) {
				yield this.decodeObject(cursor.value)
			}
		} else if (isRangeExpression(expression)) {
			const range = getRange(property, expression)
			this.log("iterating over range %o", range)
			for (let cursor = await storeIndex.openCursor(range); cursor !== null; cursor = await cursor.continue()) {
				yield this.decodeObject(cursor.value)
			}
		} else {
			signalInvalidType(expression)
		}
	}

	private getFilter(where: WhereCondition = {}): (value: ModelValue) => boolean {
		const filters: { property: string; filter: (value: PropertyValue) => boolean }[] = []
		for (const [property, expression] of Object.entries(where)) {
			const filter = this.getPropertyFilter(property, expression)
			filters.push({ property, filter })
		}

		return (value) => filters.every(({ filter, property }) => filter(value[property]))
	}

	private getSelect(select: Record<string, boolean> | undefined): (value: ModelValue) => ModelValue {
		if (select === undefined) {
			return (value) => value
		}

		const keys = Object.keys(select).filter((key) => select[key])
		return (value) => Object.fromEntries(keys.map((key) => [key, value[key]]))
	}

	private getPropertyFilter(
		propertyName: string,
		expression: PropertyValue | NotExpression | RangeExpression
	): (value: PropertyValue) => boolean {
		const property = this.model.properties.find((property) => property.name === propertyName)
		assert(property !== undefined)

		if (property.kind === "primitive") {
			return this.getPrimitiveFilter(property, expression)
		} else if (property.kind === "reference") {
			return this.getReferenceFilter(property, expression)
		} else if (property.kind === "relation") {
			return this.getRelationFilter(property, expression)
		} else {
			signalInvalidType(property)
		}
	}

	private getReferenceFilter(
		property: ReferenceProperty,
		expression: PropertyValue | NotExpression | RangeExpression
	): (value: PropertyValue) => boolean {
		if (isLiteralExpression(expression)) {
			const reference = expression
			assert(reference === null || typeof reference === "string", "invalid reference value expression")
			return (value) => value === reference
		} else if (isNotExpression(expression)) {
			const reference = expression.neq
			assert(reference === null || typeof reference === "string", "invalid reference value expression")
			return (value) => value !== reference
		} else if (isRangeExpression(expression)) {
			// idk there's no real reason not to allow this
			throw new Error("cannot use range expressions on reference values")
		} else {
			signalInvalidType(expression)
		}
	}

	private getRelationFilter(
		property: RelationProperty,
		expression: PropertyValue | NotExpression | RangeExpression
	): (value: PropertyValue) => boolean {
		if (isLiteralExpression(expression)) {
			const reference = expression
			assert(
				Array.isArray(reference) && reference.every((value) => typeof value === "string"),
				"invalid relation expression (expected string[])"
			)
			return (value) => reference.every((target) => Array.isArray(value) && value.includes(target))
		} else if (isNotExpression(expression)) {
			const reference = expression.neq
			assert(
				Array.isArray(reference) && reference.every((value) => typeof value === "string"),
				"invalid relation expression (expected string[])"
			)
			return (value) => reference.every((target) => Array.isArray(value) && !value.includes(target))
		} else if (isRangeExpression(expression)) {
			throw new Error("cannot use range expressions on relation values")
		} else {
			signalInvalidType(expression)
		}
	}

	private getPrimitiveFilter(
		property: PrimitiveProperty,
		expression: PropertyValue | NotExpression | RangeExpression
	): (value: PropertyValue) => boolean {
		const order = primitiveTypeOrders[property.type]

		if (isLiteralExpression(expression)) {
			const reference = expression
			validatePropertyValue(this.model.name, property, reference)
			return (value) => order.equals(value, reference)
		} else if (isNotExpression(expression)) {
			const reference = expression.neq
			validatePropertyValue(this.model.name, property, reference)
			return (value) => !order.equals(value, reference)
		} else if (isRangeExpression(expression)) {
			const { gt, gte, lt, lte } = expression
			for (const value of [gt, gte, lt, lte]) {
				if (value !== undefined) {
					validatePropertyValue(this.model.name, property, value)
				}
			}

			return (value) => {
				this.log("evaluating expression %o on value %o", expression, value)
				if (gt !== undefined) {
					if (order.lessThan(value, gt) || order.equals(value, gt)) {
						this.log("order.lessThan(value, gt) || order.equals(value, gt)")
						return false
					}
				}

				if (gte !== undefined) {
					if (order.lessThan(value, gte)) {
						this.log("order.lessThan(value, gte)")
						return false
					}
				}

				if (lt !== undefined) {
					if (!order.lessThan(value, lt)) {
						this.log("!order.lessThan(lt, value)")
						return false
					}
				}

				if (lte !== undefined) {
					if (!order.lessThan(value, lte) && !order.equals(value, lte)) {
						this.log("!order.lessThan(value, lte) && !order.equals(value, lte)")
						return false
					}
				}

				this.log("value satisfies the expression")
				return true
			}
		} else {
			signalInvalidType(expression)
		}
	}

	private getCompare(orderBy: Record<string, "asc" | "desc">): (a: ModelValue, b: ModelValue) => -1 | 0 | 1 {
		const entries = Object.entries(orderBy)
		assert(entries.length === 1, "orderBy must have exactly one entry")
		const [[propertyName, direction]] = entries
		const property = this.model.properties.find((property) => property.name === propertyName)
		assert(property !== undefined, "property not found")
		if (property.kind === "primitive") {
			const order = primitiveTypeOrders[property.type]
			if (direction === "asc") {
				return ({ [propertyName]: a }, { [propertyName]: b }) =>
					order.lessThan(a, b) ? -1 : order.equals(a, b) ? 0 : 1
			} else if (direction === "desc") {
				return ({ [propertyName]: a }, { [propertyName]: b }) =>
					order.lessThan(a, b) ? 1 : order.equals(a, b) ? 0 : -1
			} else {
				signalInvalidType(direction)
			}
		} else if (property.kind === "reference") {
			if (direction === "asc") {
				return ({ [propertyName]: a }, { [propertyName]: b }) =>
					stringOrder.lessThan(a, b) ? -1 : stringOrder.equals(a, b) ? 0 : 1
			} else if (direction === "desc") {
				return ({ [propertyName]: a }, { [propertyName]: b }) =>
					stringOrder.lessThan(a, b) ? 1 : stringOrder.equals(a, b) ? 0 : -1
			} else {
				signalInvalidType(direction)
			}
		} else if (property.kind === "relation") {
			throw new Error("cannot orderBy a relation property")
		} else {
			signalInvalidType(property)
		}
	}

	public encodeObject(value: ModelValue, version: Uint8Array | null): ObjectValue {
		const object: ObjectValue = { _version: version }
		for (const property of this.model.properties) {
			object[property.name] = encodePropertyValue(property, value[property.name])
		}

		return object
	}

	public decodeObject({ _version, ...object }: ObjectValue): ModelValue {
		const value: ModelValue = {}
		for (const property of this.model.properties) {
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

interface Order {
	lessThan: (a: PropertyValue, b: PropertyValue) => boolean
	equals: (a: PropertyValue, b: PropertyValue) => boolean
}

// TODO: strings in JavaScript are utf-16, not utf-8,
// and are compared unit-by-unit in utf-16 code units.
// this means strings containing surrogate pairs won't
// sort the same as they would if encoded as utf-8.
const stringOrder: Order = {
	equals: (a, b) => a === b,
	lessThan: (a, b) => {
		if (a === null && b === null) {
			return false
		} else if (a === null) {
			return true
		} else if (b === null) {
			return false
		} else {
			return a < b
		}
	},
}

const numberOrder: Order = {
	equals: (a, b) => a === b,
	lessThan: (a, b) => {
		if (a === null && b === null) {
			return false
		} else if (a === null) {
			return true
		} else if (b === null) {
			return false
		} else {
			return a < b
		}
	},
}

const byteOrder: Order = {
	equals: (a, b) => {
		if (a === null && b === null) {
			return true
		} else if (a instanceof Uint8Array && b instanceof Uint8Array) {
			return equals(a, b)
		} else {
			return false
		}
	},
	lessThan: (a, b) => {
		if (a === null && b === null) {
			return false
		} else if (a === null) {
			return true
		} else if (b === null) {
			return false
		} else if (a instanceof Uint8Array && b instanceof Uint8Array) {
			return lessThan(a, b)
		} else {
			return false
		}
	},
}

const primitiveTypeOrders: Record<PrimitiveType, Order> = {
	integer: numberOrder,
	float: numberOrder,
	string: stringOrder,
	bytes: byteOrder,
}

function encodePropertyValue(property: Property, propertyValue: PropertyValue): PropertyValue | PropertyValue[] {
	if (property.kind === "primitive") {
		if (property.optional) {
			return propertyValue === null ? [] : [propertyValue]
		} else {
			return propertyValue
		}
	} else if (property.kind === "reference") {
		if (property.optional) {
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
	if (property.kind === "primitive") {
		if (property.optional) {
			assert(Array.isArray(objectPropertyValue))
			return objectPropertyValue.length === 0 ? null : objectPropertyValue[0]
		} else {
			assert(!Array.isArray(objectPropertyValue))
			return objectPropertyValue
		}
	} else if (property.kind === "reference") {
		if (property.optional) {
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
