import assert from "assert"
import {
	ImmutableRecordAPI,
	Model,
	ModelValue,
	MutableRecordAPI,
	PrimitiveProperty,
	PropertyValue,
	RecordValue,
	ReferenceProperty,
	RelationAPI,
	TombstoneAPI,
} from "./types.js"

import { blake3 } from "@noble/hashes/blake3"
import { encode } from "microcbor"
import { base58btc } from "multiformats/bases/base58"

export const DEFAULT_DIGEST_LENGTH = 16

export function signalInvalidType(type: never): never {
	console.error(type)
	throw new TypeError("internal error: invalid type")
}

function encodePrimitiveValue(
	modelName: string,
	property: PrimitiveProperty,
	value: PropertyValue
): string | number | Buffer | null {
	if (value === null) {
		if (property.optional) {
			return null
		} else {
			throw new TypeError(`${modelName}/${property.name} cannot be null`)
		}
	} else if (property.type === "integer") {
		if (typeof value === "number" && Number.isSafeInteger(value)) {
			return value
		} else {
			throw new TypeError(`${modelName}/${property.name} must be an integer`)
		}
	} else if (property.type === "float") {
		if (typeof value === "number") {
			return value
		} else {
			throw new TypeError(`${modelName}/${property.name} must be a number`)
		}
	} else if (property.type === "string") {
		if (typeof value === "string") {
			return value
		} else {
			throw new TypeError(`${modelName}/${property.name} must be a string`)
		}
	} else if (property.type === "bytes") {
		if (value instanceof Uint8Array) {
			return Buffer.isBuffer(value) ? value : Buffer.from(value.buffer, value.byteOffset, value.byteLength)
		} else {
			throw new TypeError(`${modelName}/${property.name} must be a Uint8Array`)
		}
	} else {
		throw new Error(`internal error - unknown primitive type ${JSON.stringify(property.type)}`)
	}
}

function decodePrimitiveValue(modelName: string, property: PrimitiveProperty, value: string | number | Buffer | null) {
	if (value === null) {
		if (property.optional) {
			return null
		} else {
			throw new Error(`internal error - missing ${modelName}/${property.name} value`)
		}
	}

	if (property.type === "integer") {
		if (typeof value === "number" && Number.isSafeInteger(value)) {
			return value
		} else {
			console.error("expected integer, got", value)
			throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected integer)`)
		}
	} else if (property.type === "float") {
		if (typeof value === "number") {
			return value
		} else {
			console.error("expected float, got", value)
			throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected float)`)
		}
	} else if (property.type === "string") {
		if (typeof value === "string") {
			return value
		} else {
			console.error("expected string, got", value)
			throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected string)`)
		}
	} else if (property.type === "bytes") {
		if (Buffer.isBuffer(value)) {
			return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
		} else {
			console.error("expected Uint8Array, got", value)
			throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected Uint8Array)`)
		}
	} else {
		throw new Error(`internal error - unknown primitive type ${JSON.stringify(property.type)}`)
	}
}

function encodeReferenceValue(modelName: string, property: ReferenceProperty, value: PropertyValue): string | null {
	if (value === null) {
		if (property.optional) {
			return null
		} else {
			throw new TypeError(`${modelName}/${property.name} cannot be null`)
		}
	} else if (typeof value === "string") {
		return value
	} else {
		throw new TypeError(`${modelName}/${property.name} must be a string`)
	}
}

function decodeReferenceValue(
	modelName: string,
	property: ReferenceProperty,
	value: string | number | Uint8Array | null
): string | null {
	if (value === null) {
		if (property.optional) {
			return null
		} else {
			throw new TypeError(`internal error - missing ${modelName}/${property.name} value`)
		}
	} else if (typeof value === "string") {
		return value
	} else {
		throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected string)`)
	}
}

function encodeRecordParams(model: Model, value: ModelValue, params: Record<string, string>): RecordValue {
	const record: RecordValue = {}

	for (const property of model.properties) {
		const propertyValue = value[property.name]
		if (propertyValue === undefined) {
			throw new Error(`missing value for property ${model.name}/${property.name}`)
		}

		const param = params[property.name]
		if (property.kind === "primitive") {
			record[param] = encodePrimitiveValue(model.name, property, value[property.name])
		} else if (property.kind === "reference") {
			record[param] = encodeReferenceValue(model.name, property, value[property.name])
		} else {
			assert(Array.isArray(value[property.name]))
			continue
		}
	}

	return record
}

function decodeRecord(model: Model, record: RecordValue): ModelValue {
	const value: ModelValue = {}

	for (const property of model.properties) {
		if (property.kind === "primitive") {
			value[property.name] = decodePrimitiveValue(model.name, property, record[property.name])
		} else if (property.kind === "reference") {
			value[property.name] = decodeReferenceValue(model.name, property, record[property.name])
		} else if (property.kind === "relation") {
			continue
		} else {
			signalInvalidType(property)
		}
	}

	return value
}

export function getRecordHash(value: ModelValue, dkLen: number = DEFAULT_DIGEST_LENGTH): string {
	const bytes = encode(value)
	const hash = blake3(bytes, { dkLen })
	return base58btc.baseEncode(hash)
}

export class MutableModelAPI {
	readonly #tombstones: TombstoneAPI
	readonly #relations: Record<string, RelationAPI> = {}
	readonly #records: MutableRecordAPI

	readonly #resolve?: (a: string, b: string) => string

	public readonly model: Model

	constructor(
		tombstoneAPI: TombstoneAPI,
		relations: Record<string, RelationAPI>,
		records: MutableRecordAPI,
		model: Model,
		options: { resolve?: (a: string, b: string) => string } = {}
	) {
		this.#tombstones = tombstoneAPI
		this.#relations = relations
		this.#records = records
		this.model = model
		this.#resolve = options.resolve
	}

	public get(key: string): ModelValue | null {
		const record = this.#records.select({ _key: key })
		if (record === null) {
			return null
		}

		const value = decodeRecord(this.model, record)

		for (const [propertyName, relation] of Object.entries(this.#relations)) {
			value[propertyName] = relation.selectAll({ _source: key }).map(({ _target }) => _target)
		}

		return value
	}

	public set(key: string, value: ModelValue, options: { version?: string | null; metadata?: string | null } = {}) {
		let version: string | null = null
		let metadata: string | null = null

		const existingVersion = this.#records.selectVersion({ _key: key })
		const existingTombstone = this.#tombstones.select({ _key: key })

		// if conflict resolution is enable
		if (this.#resolve !== undefined) {
			version = options.version ?? null
			metadata = options.metadata ?? null

			// no-op if an existing record takes precedence
			if (existingVersion !== null && existingVersion._version !== null) {
				if (version === null) {
					return
				} else if (this.#resolve(existingVersion._version, version) === existingVersion._version) {
					return
				}
			}

			// no-op if an existing tombstone takes precedence
			if (existingTombstone !== null && existingTombstone._version !== null) {
				if (version === null) {
					return
				} else if (this.#resolve(existingTombstone._version, version) === existingTombstone._version) {
					return
				}
			}
		}

		if (existingTombstone !== null) {
			// delete the tombstone since we're about to set the record
			this.#tombstones.delete({ _key: key })
		}

		const params = encodeRecordParams(this.model, value, this.#records.params)

		if (existingVersion === null) {
			this.#records.insert({ _key: key, _version: version, _metadata: metadata, ...params })
		} else {
			this.#records.update({ _key: key, _version: version, _metadata: metadata, ...params })
			for (const relation of Object.values(this.#relations)) {
				relation.deleteAll({ _source: key })
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

				relation.create({ _source: key, _target: target })
			}
		}
	}

	public delete(key: string, options: { version?: string | null; metadata?: string | null } = {}) {
		let version: string | null = null
		let metadata: string | null = null

		const previous = this.#records.selectVersion({ _key: key })
		const tombstone = this.#tombstones.select({ _key: key })

		// if conflict resolution is enable
		if (this.#resolve !== undefined) {
			version = options.version ?? null
			metadata = options.metadata ?? null

			// no-op if an existing record takes precedence
			if (previous !== null && previous._version !== null) {
				if (version === null || this.#resolve(previous._version, version) === previous._version) {
					return
				}
			}

			// no-op if an existing tombstone takes precedence
			if (tombstone !== null && tombstone._version !== null) {
				if (version === null || this.#resolve(tombstone._version, version) === tombstone._version) {
					return
				}
			}
		}

		this.#records.delete({ _key: key })
		for (const relation of Object.values(this.#relations)) {
			relation.deleteAll({ _source: key })
		}

		if (this.#resolve !== undefined && version !== null) {
			if (tombstone === null) {
				this.#tombstones.insert({ _key: key, _metadata: metadata, _version: version })
			} else {
				this.#tombstones.update({ _key: key, _metadata: metadata, _version: version })
			}
		}
	}

	public async *iterate(): AsyncIterable<ModelValue> {
		yield* this.#records.selectAll({})
	}
}

export class ImmutableModelAPI {
	readonly #relations: Record<string, RelationAPI> = {}
	readonly #records: ImmutableRecordAPI
	readonly #dkLen: number

	public readonly model: Model

	constructor(
		relations: Record<string, RelationAPI>,
		records: ImmutableRecordAPI,
		model: Model,
		options: { dkLen?: number }
	) {
		this.#relations = relations
		this.#records = records
		this.model = model
		this.#dkLen = options.dkLen || DEFAULT_DIGEST_LENGTH
	}

	public add(value: ModelValue, { namespace, metadata }: { namespace?: string; metadata?: string } = {}): string {
		const recordHash = getRecordHash(value, this.#dkLen)
		const key = namespace ? `${namespace}/${recordHash}` : recordHash
		const existingRecord = this.#records.select({ _key: key })
		if (existingRecord === null) {
			const params = encodeRecordParams(this.model, value, this.#records.params)
			this.#records.insert({ _key: key, _metadata: metadata ?? null, ...params })

			for (const [propertyName, relation] of Object.entries(this.#relations)) {
				const targets = value[propertyName]

				if (!Array.isArray(targets)) {
					throw new TypeError(`${this.model.name}/${propertyName} must be string[]`)
				}

				for (const target of targets) {
					if (typeof target !== "string") {
						throw new TypeError(`${this.model.name}/${propertyName} must be string[]`)
					}

					relation.create({ _source: key, _target: target })
				}
			}
		}

		return key
	}

	public remove(key: string) {
		const existingRecord = this.#records.select({ _key: key })
		if (existingRecord !== null) {
			this.#records.delete({ _key: key })
			for (const relation of Object.values(this.#relations)) {
				relation.deleteAll({ _source: key })
			}
		}
	}

	public get(key: string): ModelValue | null {
		const record = this.#records.select({ _key: key })
		if (record === null) {
			return null
		}

		const value = decodeRecord(this.model, record)

		for (const [propertyName, relation] of Object.entries(this.#relations)) {
			value[propertyName] = relation.selectAll({ _source: key }).map(({ _target }) => _target)
		}

		return value
	}

	public async *iterate(): AsyncIterable<ModelValue> {
		yield* this.#records.selectAll({})
	}
}
