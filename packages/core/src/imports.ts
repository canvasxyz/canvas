import * as cbor from "@ipld/dag-cbor"
import { mapValues, prepare, signalInvalidType } from "@canvas-js/utils"
import { ImportType, CapturedImportType } from "./types.js"
import { equals } from "uint8arrays"

export const captureImport = (i: ImportType): CapturedImportType => {
	if (typeof i === "function") {
		return { fn: i.toString() }
	} else {
		return { value: cbor.encode(prepare(i, { replaceUndefined: true })) }
	}
}

export const uncaptureImport = (i: CapturedImportType): ImportType => {
	if ("fn" in i) {
		return new Function(i.fn) // TODO
	} else if ("value" in i) {
		return cbor.decode(i.value)
	}
	signalInvalidType(i)
}

export const uncaptureImports = (record: Record<string, CapturedImportType>): Record<string, ImportType> => {
	return mapValues(record, uncaptureImport)
}

export const trim = (str: string, prefix: string, suffix: string) => {
	return str.slice(
		str.startsWith(prefix) ? prefix.length : 0,
		str.endsWith(suffix) ? str.length - suffix.length : str.length,
	)
}

export const capturedImportsEqual = (a: ImportType, b: ImportType) => {
	const capturedA = captureImport(a)
	const capturedB = captureImport(b)

	if ("fn" in capturedA && "fn" in capturedB) {
		const [prefix, suffix] = new Function("$TOKEN").toString().split("$TOKEN")
		return trim(capturedA.fn, prefix, suffix) === trim(capturedB.fn, prefix, suffix)
	} else if ("value" in capturedA && "value" in capturedB) {
		return equals(capturedA.value, capturedB.value)
	}
	return false
}
