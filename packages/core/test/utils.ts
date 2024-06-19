import os from "node:os"
import fs from "node:fs"
import path from "node:path"

import test, { ExecutionContext } from "ava"
import { nanoid } from "nanoid"

import { Canvas, CanvasConfig } from "@canvas-js/core"

export function getDirectory(t: ExecutionContext<unknown>): string {
	const directory = path.resolve(os.tmpdir(), nanoid())
	fs.mkdirSync(directory)
	t.log("Created temporary directory", directory)
	t.teardown(() => {
		fs.rmSync(directory, { recursive: true })
		t.log("Removed temporary directory", directory)
	})
	return directory
}

export const testPlatforms = (
	name: string,
	run: (t: ExecutionContext<unknown>, open: (t: ExecutionContext, init: CanvasConfig) => Promise<Canvas>) => void,
) => {
	const macro = test.macro(run)

	test(`Sqlite (in-memory) - ${name}`, macro, async (t, init) => {
		const app = await Canvas.initialize({ ...init, path: null })
		t.teardown(() => app.stop())
		return app
	})

	test(`Sqlite (on-disk) - ${name}`, macro, async (t, init) => {
		const app = await Canvas.initialize({ ...init, path: getDirectory(t) })
		t.teardown(() => app.stop())
		return app
	})

	// test(`IndexedDB - ${name}`, macro, async (t, init) => {
	// 	const log = await GossipLogIdb.open(init)
	// 	t.teardown(() => log.close())
	// 	return log
	// })

	// test(`Postgres - ${name}`, macro, async (t, init) => {
	// 	const log = await GossipLogPostgres.open(getPgConfig(), { ...init, clear: true })
	// 	t.teardown(() => log.close())
	// 	return log
	// })
}
