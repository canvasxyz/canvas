import { ImmutableRecordAPI, Model, ModelValue, MutableRecordAPI, RelationAPI, Resolve, TombstoneAPI } from "./types.js"

import { getImmutableRecordKey } from "./utils.js"

export class MutableModelAPI {
	readonly #tombstones: TombstoneAPI
	readonly #relations: Record<string, RelationAPI> = {}
	readonly #records: MutableRecordAPI

	readonly #resolve?: Resolve

	public readonly model: Model

	constructor(
		tombstoneAPI: TombstoneAPI,
		relations: Record<string, RelationAPI>,
		records: MutableRecordAPI,
		model: Model,
		options: { resolve?: Resolve } = {}
	) {
		this.#tombstones = tombstoneAPI
		this.#relations = relations
		this.#records = records
		this.model = model
		this.#resolve = options.resolve
	}

	public async get(key: string): Promise<ModelValue | null> {
		const record = await this.#records.select({ _key: key })
		if (record === null) {
			return null
		}

		for (const [propertyName, relation] of Object.entries(this.#relations)) {
			record[propertyName] = (await relation.selectAll({ _source: key })).map(({ _target }) => _target)
		}

		return record
	}

	public async set(key: string, value: ModelValue, options: { version?: string | null } = {}) {
		let version: string | null = null

		const existingVersion = await this.#records.selectVersion({ _key: key })
		const existingTombstone = await this.#tombstones.select({ _key: key })

		// if conflict resolution is enabled
		if (this.#resolve !== undefined) {
			version = options.version ?? null

			// no-op if an existing record takes precedence
			if (existingVersion !== null && existingVersion._version !== null) {
				if (version === null) {
					return
				} else if (this.#resolve.lessThan({ version }, { version: existingVersion._version })) {
					return
				}
			}

			// no-op if an existing tombstone takes precedence
			if (existingTombstone !== null && existingTombstone._version !== null) {
				if (version === null) {
					return
				} else if (this.#resolve.lessThan({ version }, { version: existingTombstone._version })) {
					return
				}
			}
		}

		if (existingTombstone !== null) {
			// delete the tombstone since we're about to set the record
			await this.#tombstones.delete({ _key: key })
		}

		if (existingVersion === null) {
			await this.#records.insert({ _key: key, _version: version, value })
		} else {
			await this.#records.update({ _key: key, _version: version, value })
			for (const relation of Object.values(this.#relations)) {
				await relation.deleteAll({ _source: key })
			}
		}

		for (const [propertyName, relation] of Object.entries(this.#relations)) {
			const targets = value[propertyName]

			if (!Array.isArray(targets)) {
				throw new TypeError(`${this.model.name}/${propertyName} must be string[]`)
			}

			for (const target of targets) {
				if (typeof target !== "string") {
					throw new TypeError(`${this.model.name}/${propertyName} must be string[]`)
				}

				await relation.create({ _source: key, _target: target })
			}
		}
	}

	public async delete(key: string, options: { version?: string | null } = {}) {
		let version: string | null = null

		const previous = await this.#records.selectVersion({ _key: key })
		const tombstone = await this.#tombstones.select({ _key: key })

		// if conflict resolution is enable
		if (this.#resolve !== undefined) {
			version = options.version ?? null

			// no-op if an existing record takes precedence
			if (previous !== null && previous._version !== null) {
				if (version === null || this.#resolve.lessThan({ version }, { version: previous._version })) {
					return
				}
			}

			// no-op if an existing tombstone takes precedence
			if (tombstone !== null && tombstone._version !== null) {
				if (version === null || this.#resolve.lessThan({ version }, { version: tombstone._version })) {
					return
				}
			}
		}

		await this.#records.delete({ _key: key })
		for (const relation of Object.values(this.#relations)) {
			await relation.deleteAll({ _source: key })
		}

		if (this.#resolve !== undefined && version !== null) {
			if (tombstone === null) {
				await this.#tombstones.insert({ _key: key, _version: version })
			} else {
				await this.#tombstones.update({ _key: key, _version: version })
			}
		}
	}

	public iterate(): AsyncIterable<ModelValue> {
		return this.#records.iterate({})
	}

	public async selectAll(): Promise<ModelValue[]> {
		return this.#records.selectAll({})
	}

	public async query(query: {}): Promise<ModelValue[]> {
		return this.#records.query(query)
	}
}

export class ImmutableModelAPI {
	readonly #relations: Record<string, RelationAPI> = {}
	readonly #records: ImmutableRecordAPI

	public readonly model: Model

	constructor(relations: Record<string, RelationAPI>, records: ImmutableRecordAPI, model: Model) {
		this.#relations = relations
		this.#records = records
		this.model = model
	}

	public async add(value: ModelValue, { namespace }: { namespace?: string } = {}): Promise<string> {
		const key = getImmutableRecordKey(value, { namespace })
		const existingRecord = await this.#records.select({ _key: key })
		if (!existingRecord) {
			await this.#records.insert({ _key: key, value })

			for (const [propertyName, relation] of Object.entries(this.#relations)) {
				const targets = value[propertyName]

				if (!Array.isArray(targets)) {
					throw new TypeError(`${this.model.name}/${propertyName} must be string[]`)
				}

				for (const target of targets) {
					if (typeof target !== "string") {
						throw new TypeError(`${this.model.name}/${propertyName} must be string[]`)
					}

					await relation.create({ _source: key, _target: target })
				}
			}
		}

		return key
	}

	public async remove(key: string) {
		const existingRecord = await this.#records.select({ _key: key })
		if (existingRecord !== null) {
			await this.#records.delete({ _key: key })
			for (const relation of Object.values(this.#relations)) {
				await relation.deleteAll({ _source: key })
			}
		}
	}

	public async get(key: string): Promise<ModelValue | null> {
		const record = await this.#records.select({ _key: key })
		if (record === null) {
			return null
		}

		for (const [propertyName, relation] of Object.entries(this.#relations)) {
			record[propertyName] = (await relation.selectAll({ _source: key })).map(({ _target }) => _target)
		}

		return record
	}

	public iterate(): AsyncIterable<ModelValue> {
		return this.#records.iterate({})
	}

	public async selectAll(): Promise<ModelValue[]> {
		return this.#records.selectAll({})
	}

	public async query(query: {}): Promise<ModelValue[]> {
		return this.#records.query(query)
	}
}
