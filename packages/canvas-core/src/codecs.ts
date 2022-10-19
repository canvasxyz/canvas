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
	Block,
} from "@canvas-js/interfaces"

export const chainType: t.Type<Chain> = t.union([
	t.literal("eth"),
	t.literal("cosmos"),
	t.literal("solana"),
	t.literal("substrate"),
])

export const chainIdType: t.Type<ChainId> = t.union([t.number, t.string])

export const blockType: t.Type<Block> = t.type({
	chain: chainType,
	chainId: chainIdType,
	blocknum: t.number,
	blockhash: t.string,
	timestamp: t.number,
})

export const actionArgumentType: t.Type<ActionArgument> = t.union([t.null, t.boolean, t.number, t.string])

export const actionArgumentArrayType = t.array(actionArgumentType)

export const actionPayloadType: t.Type<ActionPayload> = t.intersection([
	t.type({
		from: t.string,
		spec: t.string,
		timestamp: t.number,
		call: t.string,
		args: t.array(actionArgumentType),
	}),
	t.partial({ block: blockType }),
])

export const actionType: t.Type<Action> = t.type({
	payload: actionPayloadType,
	session: t.union([t.string, t.null]),
	signature: t.string,
})

export const sessionPayloadType: t.Type<SessionPayload> = t.intersection([
	t.type({
		from: t.string,
		spec: t.string,
		timestamp: t.number,
		address: t.string,
		duration: t.number,
	}),
	t.partial({ block: blockType }),
])

export const sessionType: t.Type<Session> = t.type({
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

const modelIndexesType = t.partial({ indexes: t.array(t.string) })

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
