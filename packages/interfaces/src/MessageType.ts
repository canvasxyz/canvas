import { Action } from "./Action.js"
import { Session } from "./Session.js"
import { Snapshot } from "./Snapshot.js"

export type MessageType<AuthorizationData = any> = Action | Session<AuthorizationData> | Snapshot
