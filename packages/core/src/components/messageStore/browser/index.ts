import type { MessageStore } from "../types.js"

export type * from "../types.js"

import { IndexedDBMessageStore } from "./IndexedDBMessageStore.js"

export const openMessageStore = (
	app: string,
	directory: string | null,
	sources: Set<string> = new Set([]),
	options: { verbose?: boolean } = {}
): Promise<MessageStore> => IndexedDBMessageStore.initialize(app, directory, sources, options)
