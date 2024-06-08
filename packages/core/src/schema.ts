import { fromDSL } from "@ipld/schema/from-dsl.js"
import { create } from "@ipld/schema/typed.js"

import type { Action, Session } from "@canvas-js/interfaces"

const schema = `
type ActionContext struct {
  timestamp Int
  blockhash optional String
}

type Action struct {
  address   String
  name      String
  args      any
  context   ActionContext
}

type SessionContext struct {
  timestamp Int
  duration  optional Int
  blockhash optional String
}

type Session struct {
  address   String
  publicKey String
  authorizationData any
  context SessionContext
}

type Payload union {
  | Action "action"
  | Session "session"
} representation inline {
  discriminantKey "type"
}
`

const { toTyped } = create(fromDSL(schema), "Payload")

export function validatePayload(payload: unknown): payload is Action | Session {
	const result = toTyped(payload) as { Action: Omit<Action, "type"> } | { Session: Omit<Session, "type"> } | undefined
	return result !== undefined
}
