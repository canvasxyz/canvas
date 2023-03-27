import type { Session } from "./sessions.js"
import type { Action } from "./actions.js"
import type { CustomAction } from "./customActions.js"

export type Message = Action | Session | CustomAction
