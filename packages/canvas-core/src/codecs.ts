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
	IndexType,
	ModelType,
	ModelValue,
	Model,
	Session,
	SessionPayload,
} from "@canvas-js/interfaces"

export const actionArgumentType: t.Type<ActionArgument> = t.union([t.null, t.boolean, t.number, t.string])

export const actionPayloadType: t.Type<ActionPayload> = t.type({
	from: t.string,
	spec: t.string,
	timestamp: t.number,
	call: t.string,
	args: t.array(actionArgumentType),
})

export const actionType: t.Type<Action> = t.type({
	payload: actionPayloadType,
	session: t.union([t.string, t.null]),
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

const modelPropertiesType = t.record(t.string, modelTypeType)
const modelIndexesType = t.partial({ indexes: t.array(t.string) })

function validateModelType(u: unknown): u is Model {
	if (!modelIndexesType.is(u)) {
		return false
	}

	const { indexes, ...properties } = u

	return modelPropertiesType.is(properties)
}

export const modelType: t.Type<Model> = new t.Type(
	"Model",
	validateModelType,
	(i: unknown, context: t.Context) => {
		if (validateModelType(i)) {
			return t.success(i)
		} else {
			return t.failure(i, context)
		}
	},
	t.identity
)

export const modelsType = t.record(t.string, modelType)

export const sessionPayloadType: t.Type<SessionPayload> = t.type({
	from: t.string,
	spec: t.string,
	timestamp: t.number,
	session_public_key: t.string,
	session_duration: t.number,
})

export const sessionType: t.Type<Session> = t.type({
	payload: sessionPayloadType,
	signature: t.string,
})
