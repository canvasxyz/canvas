import cbor from "cbor"
import { Action } from "./types"

import * as t from "io-ts"

const isDate = (u: unknown): u is Date => u instanceof Date
const date = new t.Type(
	"Date",
	isDate,
	(i, context) => (isDate(i) ? t.success(i) : t.failure(i, context)),
	t.identity
)

const isBytes = (u: unknown): u is Uint8Array => u instanceof Uint8Array
const bytes = new t.Type(
	"Bytes",
	isBytes,
	(i, context) => (isBytes(i) ? t.success(i) : t.failure(i, context)),
	t.identity
)

const actionArgument = t.union([
	t.null,
	t.boolean,
	t.number,
	t.string,
	bytes,
	date,
])

const action: t.Type<Action> = t.type({
	from: t.string,
	blockhash: t.string,
	timestamp: date,
	action: t.string,
	args: t.array(actionArgument),
})

export function encodeAction(action: Action): Uint8Array {
	return cbor.encode(action)
}

export function decodeAction(data: Uint8Array): Action {
	const result = cbor.decode(data)
	if (action.is(result)) {
		return result
	} else {
		throw new Error("invalid action")
	}
}
