import { ImmutableRecordAPI, Model, ModelValue, MutableRecordAPI, RelationAPI, Resolve, TombstoneAPI } from "./types.js"

import { getImmutableRecordKey } from "./utils.js"

export type MutableModelDBContext = {
	tombstones: TombstoneAPI
	relations: Record<string, RelationAPI>
	records: MutableRecordAPI
	model: Model
	resolve?: Resolve
}

export type ImmutableModelDBContext = {
	relations: Record<string, RelationAPI>
	records: ImmutableRecordAPI
	model: Model
}

export class MutableModelAPI {
	static async get(key: string, dbContext: MutableModelDBContext): Promise<ModelValue | null> {
		const record = await dbContext.records.select({ _key: key })
		if (record === null) {
			return null
		}

		for (const [propertyName, relation] of Object.entries(dbContext.relations)) {
			record[propertyName] = (await relation.selectAll({ _source: key })).map(({ _target }) => _target)
		}

		return record
	}

	static async set(
		key: string,
		value: ModelValue,
		options: { version?: string | null } = {},
		dbContext: MutableModelDBContext
	) {
		let version: string | null = null

		const existingVersion = await dbContext.records.selectVersion({ _key: key })
		const existingTombstone = await dbContext.tombstones.select({ _key: key })

		// if conflict resolution is enabled
		if (dbContext.resolve !== undefined) {
			version = options.version ?? null

			// no-op if an existing record takes precedence
			if (existingVersion !== null && existingVersion._version !== null) {
				if (version === null) {
					return
				} else if (dbContext.resolve.lessThan({ version }, { version: existingVersion._version })) {
					return
				}
			}

			// no-op if an existing tombstone takes precedence
			if (existingTombstone !== null && existingTombstone._version !== null) {
				if (version === null) {
					return
				} else if (dbContext.resolve.lessThan({ version }, { version: existingTombstone._version })) {
					return
				}
			}
		}

		if (existingTombstone !== null) {
			// delete the tombstone since we're about to set the record
			await dbContext.tombstones.delete({ _key: key })
		}

		if (existingVersion === null) {
			await dbContext.records.insert({ _key: key, _version: version, value })
		} else {
			await dbContext.records.update({ _key: key, _version: version, value })
			for (const relation of Object.values(dbContext.relations)) {
				await relation.deleteAll({ _source: key })
			}
		}

		for (const [propertyName, relation] of Object.entries(dbContext.relations)) {
			const targets = value[propertyName]

			if (!Array.isArray(targets)) {
				throw new TypeError(`${dbContext.model.name}/${propertyName} must be string[]`)
			}

			for (const target of targets) {
				if (typeof target !== "string") {
					throw new TypeError(`${dbContext.model.name}/${propertyName} must be string[]`)
				}

				await relation.create({ _source: key, _target: target })
			}
		}
	}

	static async delete(key: string, options: { version?: string | null } = {}, dbContext: MutableModelDBContext) {
		let version: string | null = null

		const previous = await dbContext.records.selectVersion({ _key: key })
		const tombstone = await dbContext.tombstones.select({ _key: key })

		// if conflict resolution is enable
		if (dbContext.resolve !== undefined) {
			version = options.version ?? null

			// no-op if an existing record takes precedence
			if (previous !== null && previous._version !== null) {
				if (version === null || dbContext.resolve.lessThan({ version }, { version: previous._version })) {
					return
				}
			}

			// no-op if an existing tombstone takes precedence
			if (tombstone !== null && tombstone._version !== null) {
				if (version === null || dbContext.resolve.lessThan({ version }, { version: tombstone._version })) {
					return
				}
			}
		}

		await dbContext.records.delete({ _key: key })
		for (const relation of Object.values(dbContext.relations)) {
			await relation.deleteAll({ _source: key })
		}

		if (dbContext.resolve !== undefined && version !== null) {
			if (tombstone === null) {
				await dbContext.tombstones.insert({ _key: key, _version: version })
			} else {
				await dbContext.tombstones.update({ _key: key, _version: version })
			}
		}
	}

	static iterate(dbContext: MutableModelDBContext): AsyncIterable<ModelValue> {
		return dbContext.records.iterate({})
	}

	static async selectAll(dbContext: MutableModelDBContext): Promise<ModelValue[]> {
		return dbContext.records.selectAll({})
	}

	static async query(query: {}, dbContext: MutableModelDBContext): Promise<ModelValue[]> {
		return dbContext.records.query(query)
	}
}

export class ImmutableModelAPI {
	static async add(
		value: ModelValue,
		{ namespace }: { namespace?: string } = {},
		dbContext: ImmutableModelDBContext
	): Promise<string> {
		const key = getImmutableRecordKey(value, { namespace })
		const existingRecord = await dbContext.records.select({ _key: key })
		if (!existingRecord) {
			await dbContext.records.insert({ _key: key, value })

			for (const [propertyName, relation] of Object.entries(dbContext.relations)) {
				const targets = value[propertyName]

				if (!Array.isArray(targets)) {
					throw new TypeError(`${dbContext.model.name}/${propertyName} must be string[]`)
				}

				for (const target of targets) {
					if (typeof target !== "string") {
						throw new TypeError(`${dbContext.model.name}/${propertyName} must be string[]`)
					}

					await relation.create({ _source: key, _target: target })
				}
			}
		}

		return key
	}

	static async remove(key: string, dbContext: ImmutableModelDBContext) {
		const existingRecord = await dbContext.records.select({ _key: key })
		if (existingRecord !== null) {
			await dbContext.records.delete({ _key: key })
			for (const relation of Object.values(dbContext.relations)) {
				await relation.deleteAll({ _source: key })
			}
		}
	}

	static async get(key: string, dbContext: ImmutableModelDBContext): Promise<ModelValue | null> {
		const record = await dbContext.records.select({ _key: key })
		if (record === null) {
			return null
		}

		for (const [propertyName, relation] of Object.entries(dbContext.relations)) {
			record[propertyName] = (await relation.selectAll({ _source: key })).map(({ _target }) => _target)
		}

		return record
	}

	static iterate(dbContext: ImmutableModelDBContext): AsyncIterable<ModelValue> {
		return dbContext.records.iterate({})
	}

	static async selectAll(dbContext: ImmutableModelDBContext): Promise<ModelValue[]> {
		return dbContext.records.selectAll({})
	}

	static async query(query: {}, dbContext: ImmutableModelDBContext): Promise<ModelValue[]> {
		return dbContext.records.query(query)
	}
}
