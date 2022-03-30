import type { Action } from "./types"

import * as t from "io-ts"

const actionArgument = t.union([t.null, t.boolean, t.number, t.string])

export const action: t.Type<Action> = t.type({
	timestamp: t.number,
	name: t.string,
	args: t.array(actionArgument),
})
