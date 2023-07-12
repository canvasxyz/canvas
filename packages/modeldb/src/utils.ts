import assert from "node:assert"

import * as sqlite from "better-sqlite3"
import { create as createDigest } from "multiformats/hashes/digest"
import { blake3 } from "@noble/hashes/blake3"
import { CID } from "multiformats"
import { encode, code as CODE_DAG_CBOR } from "@ipld/dag-cbor"
import { base58btc } from "multiformats/bases/base58"

import type { Model, ModelValue } from "./types.js"

export const nsidPattern = /^[a-z](?:-*[a-z0-9])*(?:\.[a-z](?:-*[a-z0-9])*)*$/

const CODE_BLAKE3 = 0x1e

// always use 16-byte blake3 and dag-cbor for CIDs
export function getCID(modelValue: ModelValue): CID {
	const bytes = encode(modelValue)
	const hash = blake3(bytes, { dkLen: 16 })
	return CID.createV1(CODE_DAG_CBOR, createDigest(CODE_BLAKE3, hash))
}

// always use base58btc for stringifying CIDs
export function serializeCID(cid: CID): string {
	return cid.toString(base58btc)
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

	get(params: P): R | null {
		const result = this.statement.get(params) as R | undefined
		return result ?? null
	}

	all(params: P): R[] {
		return this.statement.all(params) as R[]
	}
}

export class Method<P> {
	private readonly statement: sqlite.Statement

	constructor(db: sqlite.Database, private readonly sql: string) {
		this.statement = db.prepare(sql)
	}

	run(params: P) {
		this.statement.run(params)
	}
}
