import { IDBPIndex, IDBPTransaction } from "idb"

import { logger } from "@libp2p/logger"

import {
	Context,
	Model,
	ModelValue,
	NotExpression,
	Property,
	PropertyValue,
	QueryParams,
	RangeExpression,
	Resolver,
} from "../types.js"

import { getCompare, getFilter, isNotExpression, isLiteralExpression, isRangeExpression } from "../query.js"
import { assert, signalInvalidType, validateModelValue } from "../utils.js"
import { getIndexName, getObjectStoreName, getTombstoneObjectStoreName } from "./utils.js"

type ObjectPropertyValue = PropertyValue | PropertyValue[]

type ObjectValue = Record<string, ObjectPropertyValue> & { _version: Uint8Array | null }

type Tombstone = { _version: Uint8Array }

export class ModelAPI {
	public readonly storeName = getObjectStoreName(this.model.name)
	public readonly tombstoneStoreName = getTombstoneObjectStoreName(this.model.name)

	private readonly log = logger(`canvas:modeldb:[${this.model.name}]`)

	constructor(readonly model: Model, readonly resolver: Resolver) {}

	private getStore<Mode extends IDBTransactionMode>(txn: IDBPTransaction<any, any, Mode>) {
		return txn.objectStore(this.storeName)
	}

	private getTombstoneStore<Mode extends IDBTransactionMode>(txn: IDBPTransaction<any, any, Mode>) {
		return txn.objectStore(this.tombstoneStoreName)
	}

	public async get<Mode extends IDBTransactionMode>(
		txn: IDBPTransaction<any, any, Mode>,
		key: string
	): Promise<ModelValue | null> {
		const value: ObjectValue | undefined = await this.getStore(txn).get(key)
		if (value === undefined) {
			return null
		} else {
			return this.decodeObject(value)
		}
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

	async query(txn: IDBPTransaction<any, any, IDBTransactionMode>, query: QueryParams): Promise<ModelValue[]> {
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
		const filter = getFilter(this.model, query.where)
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
					results.sort(getCompare(this.model, query.orderBy))
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
			if (filter(value)) {
				results.push(value)
			}
		}

		if (query.orderBy !== undefined) {
			results.sort(getCompare(this.model, query.orderBy))
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

	private getSelect(select: Record<string, boolean> | undefined): (value: ModelValue) => ModelValue {
		if (select === undefined) {
			return (value) => value
		}

		const keys = Object.keys(select).filter((key) => select[key])
		return (value) => Object.fromEntries(keys.map((key) => [key, value[key]]))
	}

	public async *iterate(
		txn: IDBPTransaction<any, any, IDBTransactionMode>
	): AsyncIterable<[key: string, value: ModelValue]> {
		// TODO: re-open the transaction if the caller awaits on other promises between yields

		const store = this.getStore(txn)
		for (let cursor = await store.openCursor(); cursor !== null; cursor = await cursor.continue()) {
			const key = cursor.key
			assert(typeof key === "string", "internal error - unexpected cursor key")
			yield [key, this.decodeObject(cursor.value)]
		}
	}

	private encodeObject(value: ModelValue, version: Uint8Array | null): ObjectValue {
		const object: ObjectValue = { _version: version }
		for (const property of this.model.properties) {
			object[property.name] = encodePropertyValue(property, value[property.name])
		}

		return object
	}

	private decodeObject({ _version, ...object }: ObjectValue): ModelValue {
		const value: ModelValue = {}
		for (const property of this.model.properties) {
			value[property.name] = decodePropertyValue(property, object[property.name])
		}

		return value
	}
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
