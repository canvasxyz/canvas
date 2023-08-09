import { createReadStream } from "node:fs"
import { resolve, join } from "node:path"
import { fileURLToPath } from "node:url"

import type { ImportOptions } from "./import.js"

export function getModuleArchive(options: ImportOptions): AsyncIterable<Uint8Array> {
	const modulePath = fileURLToPath(import.meta.url)
	const archivePath = join(modulePath, "..", "..", "..", "example.car")
	return createReadStream(archivePath)
}
