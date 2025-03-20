import AggregateError from "aggregate-error"
import { anySignal } from "any-signal"
import { blake3 } from "@noble/hashes/blake3"
import { utf8ToBytes } from "@noble/hashes/utils"
import { base64 } from "multiformats/bases/base64"
import * as cbor from "@ipld/dag-cbor"

import { assert } from "@canvas-js/utils"
import { Action, MessageType, Session, Snapshot } from "@canvas-js/interfaces"
import { SignedMessage } from "@canvas-js/gossiplog"
import { Config, isPrimaryKey, ModelSchema, PrimaryKeyValue } from "@canvas-js/modeldb"

export const isAction = (signedMessage: SignedMessage<MessageType>): signedMessage is SignedMessage<Action> =>
	signedMessage.message.payload.type === "action"

export const isSession = (signedMessage: SignedMessage<MessageType>): signedMessage is SignedMessage<Session> =>
	signedMessage.message.payload.type === "session"

export const isSnapshot = (signedMessage: SignedMessage<MessageType>): signedMessage is SignedMessage<Snapshot> =>
	signedMessage.message.payload.type === "snapshot"

export const topicPattern = /^[a-zA-Z0-9.-]+$/

export function getErrorMessage(err: unknown): string {
	if (err instanceof Error && err.name === "AggregateError") {
		const { errors } = err as AggregateError
		return errors.map(getErrorMessage).join("; ")
	} else if (err instanceof Error) {
		return `${err.name}: ${err.message}`
	} else {
		throw err
	}
}

export async function wait(interval: number, options: { signal: AbortSignal }) {
	if (options.signal.aborted) {
		return
	}

	const signal = anySignal([AbortSignal.timeout(interval), options.signal])
	await new Promise<Event>((resolve) => {
		signal.addEventListener("abort", resolve, { once: true })
	}).finally(() => signal.clear())
}

export function encodeRecordKey(
	config: Config,
	modelName: string,
	primaryKey: PrimaryKeyValue | PrimaryKeyValue[],
): string {
	const primaryProperties = config.primaryKeys[modelName]
	if (primaryProperties.length === 1 && primaryProperties[0].type === "string") {
		if (Array.isArray(primaryKey)) {
			primaryKey = primaryKey[0]
		}

		assert(typeof primaryKey === "string", 'expected typeof primaryKey === "string"')
		return primaryKey
	} else {
		if (!Array.isArray(primaryKey)) {
			primaryKey = [primaryKey]
		}

		const primaryKeyBytes = cbor.encode(primaryKey)
		return base64.baseEncode(primaryKeyBytes)
	}
}

export function decodeRecordKey(config: Config, modelName: string, key: string): PrimaryKeyValue | PrimaryKeyValue[] {
	const primaryProperties = config.primaryKeys[modelName]
	if (primaryProperties.length === 1 && primaryProperties[0].type === "string") {
		return key
	} else {
		const primaryKeyBytes = base64.baseDecode(key)
		const primaryKey = cbor.decode<PrimaryKeyValue[]>(primaryKeyBytes)
		assert(Array.isArray(primaryKey), "error decoding record key - expected array")
		assert(primaryKey.every(isPrimaryKey), "error decoding record key - expected PrimaryKeyValue[]")
		return primaryKey.length === 1 ? primaryKey[0] : primaryKey
	}
}

export function getRecordId(model: string, key: PrimaryKeyValue | PrimaryKeyValue[]): string {
	const hash2 = blake3.create({ dkLen: 18 })

	const components = Array.isArray(key) ? [model, ...key] : [model, key]
	hash2.update(writeArgument(majorTypes.ARRAY, components.length))

	for (const value of components) {
		if (typeof value === "number") {
			if (value >= 0) {
				hash2.update(writeArgument(majorTypes.UNSIGNED_INTEGER, value))
			} else {
				hash2.update(writeArgument(majorTypes.NEGATIVE_INTEGER, -value - 1))
			}
		} else if (typeof value === "string") {
			const bytes = utf8ToBytes(value)
			hash2.update(writeArgument(majorTypes.TEXT_STRING, bytes.byteLength))
			hash2.update(bytes)
		} else if (value instanceof Uint8Array) {
			hash2.update(writeArgument(majorTypes.BYTE_STRING, value.byteLength))
			hash2.update(value)
		}
	}

	return base64.baseEncode(hash2.digest())
}

const majorTypes = {
	UNSIGNED_INTEGER: 0,
	NEGATIVE_INTEGER: 1,
	BYTE_STRING: 2,
	TEXT_STRING: 3,
	ARRAY: 4,
}

const buffers = [new ArrayBuffer(1), new ArrayBuffer(2), new ArrayBuffer(3), new ArrayBuffer(5), new ArrayBuffer(9)]
const arrays = buffers.map((buffer) => new Uint8Array(buffer))
const dataViews = buffers.map((buffer) => new DataView(buffer, 1))

function writeArgument(majorType: number, argument: number): Uint8Array {
	if (argument < 24) {
		arrays[0][0] = (majorType << 5) | argument
		return arrays[0]
	} else if (argument < 0xff) {
		arrays[1][0] = (majorType << 5) | 24
		dataViews[1].setUint8(0, argument)
		return arrays[1]
	} else if (argument < 0xffff) {
		arrays[2][0] = (majorType << 5) | 25
		dataViews[2].setUint16(0, argument, false)
		return arrays[2]
	} else if (argument < 0xffffffff) {
		arrays[3][0] = (majorType << 5) | 26
		dataViews[3].setUint32(0, argument, false)
		return arrays[3]
	} else {
		arrays[4][0] = (majorType << 5) | 27
		dataViews[4].setBigUint64(0, BigInt(argument), false)
		return arrays[4]
	}
}

export const initialUpgradeSchema = {
	$sessions: {
		message_id: "primary",
		did: "string",
		public_key: "string",
		address: "string",
		expiration: "integer?",
		$indexes: ["did", "public_key"],
	},
	$actions: {
		message_id: "primary",
		did: "string",
		name: "string",
		timestamp: "integer",
		$indexes: ["did", "name"],
	},
	$effects: {
		key: "primary",
		value: "bytes?",
		branch: "integer",
		clock: "integer",
	},
	$dids: {
		did: "primary",
	},
} satisfies ModelSchema
