import type { ImportOptions } from "./import.js"

export function getModuleArchive(options: ImportOptions): AsyncIterable<Uint8Array> {
	throw new Error("Unsupported platform")
}
