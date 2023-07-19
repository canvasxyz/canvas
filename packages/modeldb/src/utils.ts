import assert from "node:assert"

import type * as sqlite from "better-sqlite3"
import { blake3 } from "@noble/hashes/blake3"
import { encode } from "microcbor"
import { base58btc } from "multiformats/bases/base58"

import type { ModelValue } from "./types.js"

export const nsidPattern = /^[a-z](?:-*[a-z0-9])*(?:\.[a-z](?:-*[a-z0-9])*)*$/

export const DEFAULT_DIGEST_LENGTH = 16

export function getRecordHash(value: ModelValue, dkLen: number = DEFAULT_DIGEST_LENGTH): string {
	const bytes = encode(value)
	const hash = blake3(bytes, { dkLen })
	return base58btc.baseEncode(hash)
}

export function signalInvalidType(type: never): never {
	console.error(type)
	throw new TypeError("internal error: invalid type")
}

export function zip<A, B>(a: A[], b: B[]): [A, B][] {
	assert(a.length === b.length, "cannot zip arrays of different sizes")
	const result = new Array(a.length)
	for (let i = 0; i < a.length; i++) {
		result[i] = [a[i], b[i]]
	}

	return result
}

export class Query<P, R> {
	private readonly statement: sqlite.Statement

	constructor(db: sqlite.Database, private readonly sql: string) {
		this.statement = db.prepare(sql)
	}

	public get(params: P): R | null {
		const result = this.statement.get(params) as R | undefined
		return result ?? null
	}

	public all(params: P): R[] {
		return this.statement.all(params) as R[]
	}

	public async *iterate(params: P): AsyncIterable<R> {
		for (const value of this.statement.iterate(params)) {
			yield value as R
		}
	}
}

export class Method<P> {
	private readonly statement: sqlite.Statement

	constructor(db: sqlite.Database, private readonly sql: string) {
		this.statement = db.prepare(sql)
	}

	public run(params: P) {
		this.statement.run(params)
	}
}

// const primitiveTypeScriptTypes: Record<PrimitiveType, string> = {
// 	integer: "number",
// 	float: "number",
// 	string: "string",
// 	bytes: "Uint8Array",
// }

// export function getTypeScriptType(property: Property): string {
// 	if (property.kind === "primitive") {
// 		const type = primitiveTypeScriptTypes[property.type]
// 		if (property.optional) {
// 			return `${type} | null`
// 		} else {
// 			return type
// 		}
// 	} else if (property.kind === "reference") {
// 		if (property.optional) {
// 			return "string | null"
// 		} else {
// 			return "string"
// 		}
// 	} else if (property.kind === "relation") {
// 		return "string[]"
// 	} else {
// 		signalInvalidType(property)
// 	}
// }

// export function getTypeError(modelName: string, property: Property): string {
// 	return `${modelName}/${property.name} must be ${getTypeScriptType(property)}`
// }
