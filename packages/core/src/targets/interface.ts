import type pg from "pg"

import type { Action, MessageType, Session, Snapshot } from "@canvas-js/interfaces"
import type { AbstractGossipLog, GossipLogInit } from "@canvas-js/gossiplog"
import type { Canvas } from "@canvas-js/core"
import type { SqlStorage } from "@cloudflare/workers-types"

export interface PlatformTarget {
	openGossipLog: (
		location: { path: string | pg.ConnectionConfig | SqlStorage | null; topic: string; clear?: boolean },
		init: GossipLogInit<MessageType>,
	) => Promise<AbstractGossipLog<MessageType>>

	listen: (app: Canvas, port: number, options?: { signal?: AbortSignal }) => Promise<void>

	buildContract: (contract: string) => Promise<string>
	buildContractByLocation: (location: string) => Promise<string>
}
