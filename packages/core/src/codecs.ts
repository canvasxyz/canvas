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
	Model,
	Session,
	SessionPayload,
	Chain,
	ChainId,
} from "@canvas-js/interfaces"
import { isLeft, isRight, left } from "fp-ts/lib/Either.js"

export const chainType: t.Type<Chain> = t.union([
	t.literal("ethereum"),
	t.literal("cosmos"),
	t.literal("near"),
	t.literal("solana"),
	t.literal("substrate"),
])

export const chainIdType: t.Type<ChainId> = t.string

export const actionArgumentType: t.Type<ActionArgument> = t.union([t.null, t.boolean, t.number, t.string])

export const actionPayloadType: t.Type<ActionPayload> = t.type({
	from: t.string,
	app: t.string,
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
	app: t.string,
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

/**
 * This function converts a decode function into an is function (for defining io-ts types)
 * by throwing away the errors and returned value, just returning whether the input data
 * was validated or not.
 * @param decodeFunc
 * @returns
 */
function decodeToIs<T>(decodeFunc: (input: unknown, context: t.Context) => t.Validation<T>): t.Is<T> {
	function is(input: unknown): input is T {
		return isRight(decodeFunc(input, []))
	}
	return is
}

function getErrors(validation: t.Validation<any>): t.Errors {
	return isLeft(validation) ? validation.left : []
}

const decodeModelPropertyName = (input: unknown, context: t.Context): t.Validation<string> => {
	if (!t.string.is(input)) {
		return t.failure(input, context, `Model property name ${input} is invalid: it must be a string`)
	}

	const modelPropertyNamePattern = /^[a-z][a-z_]*$/

	if (!modelPropertyNamePattern.test(input)) {
		return t.failure(
			input,
			context,
			`Model property '${input}' is invalid: model properties must match ${modelPropertyNamePattern}`
		)
	}

	return t.success(input)
}

const modelPropertyNameType = new t.Type<string>(
	"ModelPropertyName",
	decodeToIs(decodeModelPropertyName),
	decodeModelPropertyName,
	t.identity
)

export const modelTypeType: t.Type<ModelType> = t.union([
	t.literal("boolean"),
	t.literal("string"),
	t.literal("integer"),
	t.literal("float"),
	t.literal("datetime"),
])

function decodeSingleIndex(i: unknown, context: t.Context): t.Validation<string | string[]> {
	let indices: string[]
	if (t.string.is(i)) {
		indices = [i]
	} else if (t.array(t.string).is(i)) {
		indices = i
	} else {
		return t.failure(i, context, `Index is invalid: ${i} is not a string or a list of strings`)
	}

	let errors: t.ValidationError[] = []
	// check is not id
	for (const index of indices) {
		if (index == "id") {
			errors.push({ value: i, context, message: `Index is invalid: 'id' is already an index by default` })
		}
	}

	return errors ? t.failures(errors) : t.success(i)
}

const singleIndexType = new t.Type<string | string[]>(
	"SingleIndexType",
	decodeToIs(decodeSingleIndex),
	decodeSingleIndex,
	t.identity
)

function decodeModel(i: unknown, context: t.Context): t.Validation<Model> {
	/***
	 * Unfortunately, this has to be validated imperatively because io-ts doesn't
	 * handle intersection + record types properly
	 */

	// get the model name if it exists
	const contextParent = context[context.length - 1]
	const modelName = contextParent ? contextParent.key : ""
	const modelNameInsert = modelName ? ` '${modelName}'` : ""

	if (!t.UnknownRecord.is(i)) {
		return t.failure(i, context, `Model${modelNameInsert} must be an object`)
	}

	const { indexes, id, updated_at, ...properties } = i

	let errors: t.ValidationError[] = []

	if (id) {
		if (id !== "string") {
			errors.push({
				value: i,
				context,
				message: `Model${modelNameInsert} is invalid: 'id' field should be 'string', but is the wrong type ${id}`,
			})
		}
	} else {
		errors.push({
			value: i,
			context,
			message: `Model${modelNameInsert} is invalid: there is no 'id' field`,
		})
	}

	if (updated_at) {
		if (updated_at !== "datetime") {
			errors.push({
				value: i,
				context,
				message: `Model${modelNameInsert} is invalid: 'updated_at' field should be 'datetime', but is the wrong type ${updated_at}`,
			})
		}
	} else {
		errors.push({
			value: i,
			context,
			message: `Model${modelNameInsert} is invalid: there is no 'updated_at' field`,
		})
	}

	if (indexes) {
		errors = errors.concat(getErrors(t.array(singleIndexType).decode(indexes)))
	}

	for (const [k, v] of Object.entries(properties)) {
		errors = errors.concat(getErrors(modelPropertyNameType.decode(k)))

		if (!modelTypeType.is(v)) {
			errors.push({
				value: i,
				context,
				message: `Model${modelNameInsert} is invalid: '${k}' field has an invalid type ('${v}')`,
			})
		}
	}

	return errors ? left(errors) : t.success(i as Model)
}

export const modelType: t.Type<Model> = new t.Type("Model", decodeToIs(decodeModel), decodeModel, t.identity)

const decodeModelName = (input: unknown, context: t.Context): t.Validation<string> => {
	if (!t.string.is(input)) {
		return t.failure(input, context, `Model name '${input}' is invalid: it must be a string`)
	}

	const modelNamePattern = /^[a-z][a-z_]*$/
	if (!modelNamePattern.test(input)) {
		return t.failure(input, context, `Model name '${input}' is invalid: model names must match ${modelNamePattern}`)
	}

	return t.success(input)
}
const modelNameType = new t.Type<string>("ModelName", decodeToIs(decodeModelName), decodeModelName, t.identity)

export const modelsType = t.record(modelNameType, modelType)

const isUint8Array = (u: unknown): u is Uint8Array => u instanceof Uint8Array

export const uint8ArrayType = new t.Type(
	"Uint8Array",
	isUint8Array,
	(i, context) => (isUint8Array(i) ? t.success(i) : t.failure(i, context)),
	t.identity
)
