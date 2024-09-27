import type pg from "pg"

import type { Action, Session, Snapshot } from "@canvas-js/interfaces"
import type { AbstractGossipLog, GossipLogInit } from "@canvas-js/gossiplog"
import type { Canvas } from "@canvas-js/core"

export interface PlatformTarget {
	openGossipLog: (
		location: { path: string | pg.ConnectionConfig | null; topic: string },
		init: GossipLogInit<Action | Session | Snapshot>,
	) => Promise<AbstractGossipLog<Action | Session | Snapshot>>

	listen: (app: Canvas, port: number, options?: { signal?: AbortSignal }) => Promise<void>
}
