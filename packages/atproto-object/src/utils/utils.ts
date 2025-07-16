import { JSValue } from "@canvas-js/utils"
import type { AtInit, AtConfig } from "../types.js"

export const isStringArray = (arr: unknown): arr is string[] => {
	return Array.isArray(arr) && arr.every((item: unknown) => typeof item === "string")
}

// Translate init syntaxes into a map of AtConfigs
export const getConfig = (init: AtInit): Record<string, AtConfig> => {
	if (!Array.isArray(init)) {
		return Object.fromEntries(
			Object.entries(init).map(([table, config]) => {
				return [table, typeof config === "string" ? { nsid: config } : config]
			}),
		)
	} else if (isStringArray(init)) {
		return Object.fromEntries(init.map((nsid: string) => [nsid, { nsid }]))
	} else {
		return Object.fromEntries(init.map(({ table, $type }) => [table, { nsid: $type }]))
	}
}

// Build firehose WebSocket URL
export const buildFirehoseUrl = (baseUrl: string, cursor?: string): string => {
	const url = new URL(baseUrl)

	if (url.pathname === "/" || url.pathname === "/subscribe") {
		url.pathname = "/xrpc/com.atproto.sync.subscribeRepos"
	}

	if (cursor) {
		url.searchParams.set("cursor", cursor)
	}

	return url.toString()
}

// Look up field inside JSValue by path
export const getValueAtPath = (obj: JSValue, path: string[]): JSValue | null => {
	let current: JSValue = obj
	for (const key of path) {
		if (current == null || typeof current !== "object" || Array.isArray(current)) {
			return null
		}
		if (!(key in current)) {
			return null
		}
		current = (current as Record<string, JSValue>)[key]
	}
	return current
}
