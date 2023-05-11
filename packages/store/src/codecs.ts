import * as t from "io-ts"

const isUint8Array = (u: unknown): u is Uint8Array => u instanceof Uint8Array

const uint8ArrayType = new t.Type<Uint8Array>(
	"Uint8Array",
	isUint8Array,
	(i, context) => (isUint8Array(i) ? t.success(i) : t.failure(i, context)),
	t.identity
)

export type DiscoveryRecord = { id: Uint8Array; addresses: string[]; topics: string[] }

export const discoveryRecordType: t.Type<DiscoveryRecord> = t.type({
	id: uint8ArrayType,
	addresses: t.array(t.string),
	topics: t.array(t.string),
})

export type InsertionRecord = { key: Uint8Array; value: Uint8Array }

export const insertionRecordType = t.type({ key: uint8ArrayType, value: uint8ArrayType })
