import * as t from "io-ts"

/**
 * These are io-ts codecs for all of the types defined in @canvas-js/interfaces.
 * We define these here and not in @canvas-js/interfaces because we want to import
 * @canvas-js/interfaces in client-side (ie React) code but would like to avoid imporing
 * io-ts except on the server (it's heavy and you typically only need runtime validation
 * on the server).
 */

import type {
	ActionArgument,
	ActionPayload,
	Action,
	ModelType,
	ModelValue,
	Model,
	Session,
	SessionPayload,
	Chain,
	ChainId,
} from "@canvas-js/interfaces"

export const chainType: t.Type<Chain> = t.union([
	t.literal("eth"),
	t.literal("cosmos"),
	t.literal("near"),
	t.literal("solana"),
	t.literal("substrate"),
])

export const chainIdType: t.Type<ChainId> = t.string

export const actionArgumentType: t.Type<ActionArgument> = t.union([t.null, t.boolean, t.number, t.string])

export const actionPayloadType: t.Type<ActionPayload> = t.type({
	from: t.string,
	spec: t.string,
	timestamp: t.number,
	call: t.string,
	args: t.record(t.string, actionArgumentType),
	chain: chainType,
	chainId: chainIdType,
	blockhash: t.union([t.string, t.null]),
})

export const actionType: t.Type<Action> = t.type({
	type: t.literal("action"),
	payload: actionPayloadType,
	session: t.union([t.string, t.null]),
	signature: t.string,
})

export const sessionPayloadType: t.Type<SessionPayload> = t.type({
	from: t.string,
	spec: t.string,
	timestamp: t.number,
	address: t.string,
	duration: t.number,
	chain: chainType,
	chainId: chainIdType,
	blockhash: t.union([t.string, t.null]),
})

export const sessionType: t.Type<Session> = t.type({
	type: t.literal("session"),
	payload: sessionPayloadType,
	signature: t.string,
})

export const modelTypeType: t.Type<ModelType> = t.union([
	t.literal("boolean"),
	t.literal("string"),
	t.literal("integer"),
	t.literal("float"),
	t.literal("datetime"),
])

export const modelValueType: t.Type<ModelValue> = t.union([t.null, t.boolean, t.number, t.string])

const modelPropertiesType = t.intersection([
	t.type({ id: t.literal("string"), updated_at: t.literal("datetime") }),
	t.record(t.string, modelTypeType),
])

const indexType = t.union([t.string, t.array(t.string)])
const modelIndexesType = t.partial({ indexes: t.array(indexType) })

function isModel(u: unknown): u is Model {
	if (!modelIndexesType.is(u)) {
		return false
	}

	const { indexes, ...properties } = u

	return modelPropertiesType.is(properties)
}

export const modelType: t.Type<Model> = new t.Type(
	"Model",
	isModel,
	(i: unknown, context: t.Context) => (isModel(i) ? t.success(i) : t.failure(i, context)),
	t.identity
)

export const modelsType = t.record(t.string, modelType)

const isUint8Array = (u: unknown): u is Uint8Array => u instanceof Uint8Array

export const uint8ArrayType = new t.Type(
	"Uint8Array",
	isUint8Array,
	(i, context) => (isUint8Array(i) ? t.success(i) : t.failure(i, context)),
	t.identity
)
