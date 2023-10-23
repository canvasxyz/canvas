import { fromDSL } from "@ipld/schema/from-dsl.js"
import { create } from "@ipld/schema/typed.js"

import { Action, Session } from "@canvas-js/interfaces"

export const schema = `
type Action struct {
  chain String
  address String
  name String
  args any
  blockhash nullable String
  timestamp Int
}

type Session struct {
  chain String
  address String
  publicKeyType String
  publicKey Bytes
  data any
  blockhash nullable String
  timestamp Int
  duration nullable Int
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
