import { fromDSL } from "@ipld/schema/from-dsl.js"
import { create } from "@ipld/schema/typed.js"

import type { Action, MessageType, Session, Snapshot, Updates } from "@canvas-js/interfaces"

const schema = `
type ActionContext struct {
  timestamp Int
  blockhash optional String
}

type Action struct {
  did       String
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
  did       String
  publicKey String
  authorizationData any
  context SessionContext
}

type SnapshotEffect struct {
  key       String
  value     nullable Bytes
}

type Snapshot struct {
  models    {String:[Bytes]}
  effects   [SnapshotEffect]
}

type Update = {
	model: string
	key: string
	diff: Uint8Array
}

type Updates = {
	type: "updates"
	updates: Update[]
}

type Payload union {
  | Action "action"
  | Session "session"
  | Snapshot "snapshot"
  | Updates "updates"
} representation inline {
  discriminantKey "type"
}
`

const { toTyped } = create(fromDSL(schema), "Payload")

export function validatePayload(payload: unknown): payload is MessageType {
	const result = toTyped(payload) as
		| { Action: Omit<Action, "type"> }
		| { Session: Omit<Session, "type"> }
		| { Snapshot: Omit<Snapshot, "type"> }
		| { Updates: Omit<Updates, "type"> }
		| undefined
	return result !== undefined
}
