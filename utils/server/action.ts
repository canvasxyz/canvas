import type { Action, ActionPayload } from "./types"

import * as t from "io-ts"

const actionArgument = t.union([t.null, t.boolean, t.number, t.string])

export const payload: t.Type<ActionPayload> = t.type({
	from: t.string,
	timestamp: t.number,
	name: t.string,
	args: t.array(actionArgument),
})

export const action: t.Type<Action> = t.type({
	from: t.string,
	chainId: t.string,
	signature: t.string,
	payload: t.string,
})
