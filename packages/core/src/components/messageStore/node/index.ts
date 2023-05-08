import type { MessageStore } from "../types.js"

import { SqliteMessageStore } from "./SqliteMessageStore.js"
import { MemoryMessageStore } from "./MemoryMessageStore.js"

export * from "../types.js"

export function openMessageStore(
	app: string,
	directory: string | null,
	sources: Set<string> = new Set([]),
	options: { verbose?: boolean } = {}
): Promise<MessageStore> {
	if (directory === null) {
		return MemoryMessageStore.initialize(app, sources)
	} else {
		return SqliteMessageStore.initialize(app, directory, sources, options)
	}
}
