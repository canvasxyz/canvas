import { sha256 } from "@noble/hashes/sha256"

import type { MessageType, SessionSigner, Action } from "@canvas-js/interfaces"
import {
	ModelValue,
	PropertyValue,
	RelationValue,
	PrimaryKeyValue,
	validateModelValue,
	updateModelValue,
	mergeModelValue,
	isRelationValue,
	equalReferences,
} from "@canvas-js/modeldb"
import { AbstractGossipLog, SignedMessage } from "@canvas-js/gossiplog"
import { assert, signalInvalidType } from "@canvas-js/utils"

import { decodeRecordValue, getRecordId } from "./utils.js"

import { View, TransactionalRead } from "./View.js"
import { bytesToHex } from "@noble/hashes/utils"
import { PRNG } from "./random.js"

export class ExecutionContext extends View {
	// recordId -> { version, value, csx }
	public readonly transactionalReads: Map<string, TransactionalRead | null> = new Map()

	// recordId -> value
	public readonly lwwReads: Map<string, ModelValue | null> = new Map()

	// recordId -> { model, key, value, csx }
	public readonly writes: Map<
		string,
		{
			model: string
			key: PrimaryKeyValue | PrimaryKeyValue[]
			value: ModelValue | null
			csx: number | null
		}
	> = new Map()

	public readonly prng: PRNG

	constructor(
		public readonly messageLog: AbstractGossipLog<MessageType>,
		public readonly signedMessage: SignedMessage<Action>,
		public readonly signer: SessionSigner,
	) {
		super(messageLog, signedMessage.parents)

		const hash = sha256(signedMessage.value)
		const seed = BigInt("0x" + bytesToHex(hash.subarray(0, 8)))
		this.prng = new PRNG(seed)
	}

	public get id() {
		return this.signedMessage.id
	}

	public get signature() {
		return this.signedMessage.signature
	}

	public get publicKey() {
		return this.signature.publicKey
	}

	public get message() {
		return this.signedMessage.message
	}

	public get did() {
		return this.message.payload.did
	}

	public get address() {
		return this.signer.getAddressFromDid(this.did)
	}

	public async getModelValue<T extends ModelValue = ModelValue>(
		model: string,
		key: PrimaryKeyValue | PrimaryKeyValue[],
		transactional: boolean,
	): Promise<T | null> {
		assert(this.db.models[model] !== undefined, "model not found")
		this.log("getModelValue(%s, %o, %o)", model, key, transactional)

		const recordId = getRecordId(model, key)

		if (this.writes.has(recordId)) {
			const { value } = this.writes.get(recordId)!
			return value as T | null
		}

		if (transactional) {
			if (this.transactionalReads.has(recordId)) {
				const { value = null } = this.transactionalReads.get(recordId) ?? {}
				return value as T | null
			}

			const result = await this.getLastValueTransactional<T>(model, key, recordId)
			this.transactionalReads.set(recordId, result)
			return result?.value ?? null
		} else {
			if (this.lwwReads.has(recordId)) {
				const value = this.lwwReads.get(recordId)!
				return value as T | null
			}

			const write = await this.getLastValue(recordId)
			if (write === null || write.value === null) {
				this.lwwReads.set(recordId, null)
				return null
			} else {
				const value = decodeRecordValue(this.db.config, model, write.value)
				this.lwwReads.set(recordId, value)
				return value as T
			}
		}
	}

	public async setModelValue(model: string, value: ModelValue, transactional: boolean): Promise<void> {
		assert(this.db.models[model] !== undefined, "model not found")
		this.log("setModelValue(%s, %o, %s)", model, value, transactional)

		validateModelValue(this.db.models[model], value)

		const primaryProperties = this.db.config.primaryKeys[model]
		const key = primaryProperties.map((property) => value[property.name] as PrimaryKeyValue)

		const recordId = getRecordId(model, key)
		let csx: number | null = null
		if (transactional) {
			const [previousCSX] = await this.getLatestConflictSet(recordId)
			csx = (previousCSX ?? 0) + 1
		}

		this.writes.set(recordId, { model, key, value, csx })
	}

	public async deleteModelValue(
		model: string,
		key: PrimaryKeyValue | PrimaryKeyValue[],
		transactional: boolean,
	): Promise<void> {
		assert(this.db.models[model] !== undefined, "model not found")
		this.log("deleteModelValue(%s, %o, %s)", model, key, transactional)

		const recordId = getRecordId(model, key)
		let csx: number | null = null
		if (transactional) {
			const [previousCSX] = await this.getLatestConflictSet(recordId)
			csx = (previousCSX ?? 0) + 1
		}

		this.writes.set(recordId, { model, key, value: null, csx })
	}

	public async updateModelValue(
		model: string,
		value: Record<string, PropertyValue | undefined>,
		transactional: boolean,
	): Promise<void> {
		if (this.db.models[model] === undefined) {
			throw new Error(`model db.${model} not found`)
		}

		if (!transactional) {
			throw new Error("`db.update(...) can only be called from inside a transaction")
		}

		const primaryProperties = this.db.config.primaryKeys[model]
		const key = primaryProperties.map((property) => value[property.name] as PrimaryKeyValue)
		const previousValue = await this.getModelValue(model, key, transactional)
		const result = updateModelValue(value, previousValue)
		await this.setModelValue(model, result, transactional)
	}

	public async mergeModelValue(
		model: string,
		value: Record<string, PropertyValue | undefined>,
		transactional: boolean,
	): Promise<void> {
		if (this.db.models[model] === undefined) {
			throw new Error(`model db.${model} not found`)
		}

		if (!transactional) {
			throw new Error("`db.merge(...) can only be called from inside a transaction")
		}

		const primaryProperties = this.db.config.primaryKeys[model]
		const key = primaryProperties.map((property) => value[property.name] as PrimaryKeyValue)
		const previousValue = await this.getModelValue(model, key, transactional)
		const result = mergeModelValue(value, previousValue)
		await this.setModelValue(model, result, transactional)
	}

	public async linkModelValue(
		modelProperty: string,
		source: PrimaryKeyValue | PrimaryKeyValue[],
		target: PrimaryKeyValue | PrimaryKeyValue[],
		transactional: boolean,
	) {
		const [model, propertyName] = modelProperty.split(".")
		if (model === undefined || propertyName === undefined) {
			throw new Error(`db.link failed - must provide model.propertyName`)
		}
		if (this.db.models[model] === undefined) {
			throw new Error(`model db.${model} not found`)
		}

		const relationProperty = this.db.models[model].properties.find((property) => property.name === propertyName)
		if (relationProperty === undefined) {
			throw new Error(`db.link(...) failed - model '${model}' has no property '${propertyName}'`)
		} else if (relationProperty.kind !== "relation") {
			throw new Error(`db.link(...) failed - '${model}/${propertyName}' is not a relation property`)
		}

		if (!transactional) {
			throw new Error("`db.link(...) can only be called from inside a transaction")
		}

		const previousValue = await this.getModelValue(model, source, transactional)
		if (previousValue === null) {
			throw new Error("db.link(...) failed - source record not found")
		}

		const previousTargets = previousValue[propertyName]
		assert(isRelationValue(previousTargets), "internal error - expected isRelationValue(previousValueLinks)")

		// no-op if the source already links to the target
		if (previousTargets.some((key) => equalReferences(key, target))) {
			return
		}

		const newTargets = [...previousTargets, target] as RelationValue
		await this.setModelValue(model, { ...previousValue, [propertyName]: newTargets }, transactional)
	}

	public async unlinkModelValue(
		modelProperty: string,
		source: PrimaryKeyValue | PrimaryKeyValue[],
		target: PrimaryKeyValue | PrimaryKeyValue[],
		transactional: boolean,
	) {
		const [model, propertyName] = modelProperty.split(".")
		if (model === undefined || propertyName === undefined) {
			throw new Error(`db.unlink failed - must provide model.propertyName`)
		}
		if (this.db.models[model] === undefined) {
			throw new Error(`db.unlink failed - model db.${model} not found`)
		}

		const relationProperty = this.db.models[model].properties.find((property) => property.name === propertyName)
		if (relationProperty === undefined) {
			throw new Error(`db.unlink(...) failed - model '${model}' has no property '${propertyName}'`)
		} else if (relationProperty.kind !== "relation") {
			throw new Error(`db.unlink(...) failed - '${model}/${propertyName}' is not a relation property`)
		}

		if (!transactional) {
			throw new Error("`db.unlink(...) can only be called from inside a transaction")
		}

		const previousValue = await this.getModelValue(model, source, transactional)
		if (previousValue === null) {
			throw new Error("db.unlink(...) failed - source record not found")
		}

		const previousTargets = previousValue[propertyName]
		assert(isRelationValue(previousTargets), "internal error - expected isRelationValue(previousValueLinks)")

		const newTargets = previousTargets.filter((key) => !equalReferences(key, target)) as RelationValue

		// no-op if the source doesn't contain the target
		if (newTargets.length === previousTargets.length) {
			return
		}

		await this.setModelValue(model, { ...previousValue, [propertyName]: newTargets }, transactional)
	}

	async createModelValue(model: string, value: ModelValue, transactional: boolean) {
		assert(this.db.models[model] !== undefined, "model not found")
		this.log("createModelValue(%s, %o, %s)", model, value, transactional)

		const initialValue = { ...value }
		for (const property of this.db.models[model].properties) {
			if (initialValue[property.name] === undefined) {
				if (property.kind === "primitive" || property.kind === "reference") {
					if (property.nullable) {
						initialValue[property.name] = null
					}
				} else if (property.kind === "relation") {
					initialValue[property.name] = []
				} else {
					signalInvalidType(property)
				}
			}
		}

		// If the `primary` key isn't in a db.create() initialValue, use the message ID.
		// Experimental and still required for db.set() and in the types. TODO: Use the id factory?
		if (
			initialValue[this.db.models[model].primaryKey[0]] === undefined &&
			this.db.models[model].primaryKey.length === 1
		) {
			initialValue[this.db.models[model].primaryKey[0]] = this.id
		}
		validateModelValue(this.db.models[model], initialValue)

		const primaryProperties = this.db.config.primaryKeys[model]
		const key = primaryProperties.map((property) => initialValue[property.name] as PrimaryKeyValue)

		const recordId = getRecordId(model, key)
		let csx: number | null = null
		if (transactional) {
			const [previousCSX] = await this.getLatestConflictSet(recordId)
			csx = (previousCSX ?? 0) + 1
		}

		this.writes.set(recordId, { model, key, value: initialValue, csx })
	}
}
