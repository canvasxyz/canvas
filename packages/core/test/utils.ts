import os from "node:os"
import fs from "node:fs"
import path from "node:path"

import type { ExecutionContext } from "ava"
import { nanoid } from "nanoid"

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
