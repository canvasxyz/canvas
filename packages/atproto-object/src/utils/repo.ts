import { CarReader } from "@ipld/car"
import * as cbor from "@ipld/dag-cbor"
import { CID } from "multiformats"
import { cborDecodeMulti } from "@atproto/common"
import type { FirehoseEvent, FirehoseErrorFrame } from "../types.js"

type MSTNode = { l: CID; e: MSTEntry[] }
type MSTEntry = { p: number; k: Uint8Array; v?: CID; t?: CID }

export const parseRecordKey = (key: string): { collection: string | null; rkey: string | null } => {
	const parts = key.split("/")
	if (parts.length >= 2) {
		return {
			collection: parts[0],
			rkey: parts[1],
		}
	}
	return {
		collection: null,
		rkey: null,
	}
}

export const walkMST = async (
	car: CarReader,
	rootCid: CID,
	prefix = "",
	log?: (message: string, ...args: any[]) => void,
): Promise<Array<{ collection: string; rkey: string; record: any }>> => {
	const records: Array<{ collection: string; rkey: string; record: any }> = []
	const decoder = new TextDecoder()

	try {
		const block = await car.get(rootCid)
		if (!block) {
			return records
		}

		const node = cbor.decode<MSTNode>(block.bytes)

		// Process entries in this node
		let currentKey = ""
		for (const entry of node.e) {
			// Reconstruct the key
			currentKey = currentKey.slice(0, entry.p) + decoder.decode(entry.k)

			// If this entry has a value, it's a record
			if (entry.v) {
				const recordBlock = await car.get(entry.v)
				if (recordBlock) {
					const recordData = cbor.decode<any>(recordBlock.bytes)
					const { collection, rkey } = parseRecordKey(currentKey)
					if (collection && rkey) {
						records.push({
							collection,
							rkey,
							record: recordData,
						})
					}
				}
			}

			// If this entry has a tree pointer, recursively process it
			if (entry.t) {
				const subRecords = await walkMST(car, entry.t, currentKey, log)
				records.push(...subRecords)
			}
		}

		// Process the left pointer if it exists
		if (node.l) {
			const leftRecords = await walkMST(car, node.l, prefix, log)
			records.push(...leftRecords)
		}
	} catch (error) {
		log?.("Error walking MST: %O", error)
	}

	return records
}

export const parseCarFile = async function (
	carBytes: Uint8Array,
	log?: (message: string, ...args: any[]) => void,
): Promise<Array<{ collection: string; rkey: string; record: any }>> {
	const records: Array<{ collection: string; rkey: string; record: any }> = []

	try {
		const car = await CarReader.fromBytes(carBytes)
		const [root] = await car.getRoots()
		const block = await car.get(root)

		if (!block) {
			throw new Error("Invalid CAR file: missing root block")
		}

		const commit = cbor.decode<{ data: CID }>(block.bytes)

		// Walk the MST to extract all records
		const extractedRecords = await walkMST(car, commit.data, "", log)
		records.push(...extractedRecords)
	} catch (error) {
		log?.("Error parsing CAR file: %O", error)
		throw error
	}

	return records
}

/**
 * Extract a specific record from CAR data by path
 */
export const extractRecordFromCarByPath = async (
	carBytes: Uint8Array,
	path: string,
	log?: (message: string, ...args: any[]) => void,
): Promise<any | null> => {
	if (!carBytes || carBytes.length === 0) {
		return null
	}

	try {
		const car = await CarReader.fromBytes(carBytes)
		const [root] = await car.getRoots()
		const block = await car.get(root)

		if (!block) {
			return null
		}

		const commit = cbor.decode<{ data: CID }>(block.bytes)
		const records = await walkMST(car, commit.data, "", log)

		// Find the record that matches the path
		const { collection, rkey } = parseRecordKey(path)
		if (!collection || !rkey) {
			return null
		}

		const record = records.find((r) => r.collection === collection && r.rkey === rkey)
		return record?.record || null
	} catch (error) {
		log?.("Error extracting record from CAR by path: %O", error)
		return null
	}
}

export const getPdsEndpoint = async function (
	did: string,
	log?: (message: string, ...args: any[]) => void,
): Promise<string | null> {
	try {
		if (did.startsWith("did:plc:")) {
			const plcUrl = `https://plc.directory/${did}`
			const response = await fetch(plcUrl, {
				method: "GET",
				headers: { "User-Agent": "AtObject/1.0" },
				signal: AbortSignal.timeout(5000),
			})

			if (response.ok) {
				const didDoc = await response.json()
				if (didDoc.service) {
					for (const service of didDoc.service) {
						if (service.id === "#atproto_pds" && service.serviceEndpoint) {
							return service.serviceEndpoint
						}
					}
				}
			}
		}

		if (did.startsWith("did:web:")) {
			const domain = did.replace("did:web:", "").replace(/:/g, "/")
			const webUrl = `https://${domain}/.well-known/did.json`
			const response = await fetch(webUrl, {
				method: "GET",
				headers: { "User-Agent": "AtObject/1.0" },
				signal: AbortSignal.timeout(5000),
			})

			if (response.ok) {
				const didDoc = await response.json()
				if (didDoc.service) {
					for (const service of didDoc.service) {
						if (service.id === "#atproto_pds" && service.serviceEndpoint) {
							return service.serviceEndpoint
						}
					}
				}
			}
		}
	} catch (error) {
		log?.("Error resolving DID %s: %O", did, error)
		return null
	}
	return null
}

/**
 * Parse a binary AT Protocol firehose frame
 * Format: header (DAG-CBOR) + payload (DAG-CBOR)
 */
export const parseFirehoseFrame = (data: Uint8Array): FirehoseEvent | null => {
	try {
		const frame = cborDecodeMulti(data)
		if (frame.length !== 2) {
			throw new Error("expected header and body in firehose frame")
		}
		const header = frame[0] as { t: string; op: number }

		if (header.op === -1) {
			const errorPayload = cbor.decode(frame[1] as any) as FirehoseErrorFrame
			return {
				kind: "error",
				error: errorPayload,
			}
		} else if (header.op === 1) {
			const payload = frame[1] as any

			switch (header.t) {
				case "#commit":
					return {
						kind: "commit",
						commit: payload,
					}
				case "#identity":
					return {
						kind: "identity",
						identity: payload,
					}
				case "#account":
					return {
						kind: "account",
						account: payload,
					}
				case "#info":
					return {
						kind: "info",
						info: payload,
					}
				default:
					// Unknown message type, skip
					return null
			}
		}

		return null
	} catch (error) {
		console.error("Error parsing firehose frame:", error)
		return null
	}
}

/**
 * Extract operations from firehose commit event
 */
export const extractCommitOperations = (
	commit: any,
): Array<{
	action: "create" | "update" | "delete"
	collection: string
	rkey: string
	// record?: any
}> => {
	const operations: Array<{
		action: "create" | "update" | "delete"
		collection: string
		rkey: string
		// record?: any
	}> = []

	if (!commit.ops || !Array.isArray(commit.ops)) {
		return operations
	}

	for (const op of commit.ops) {
		if (!op.path) continue

		const pathParts = op.path.split("/")
		if (pathParts.length < 2) continue

		const collection = pathParts[0]
		const rkey = pathParts[1]

		let action: "create" | "update" | "delete"
		if (op.action === "create") {
			action = "create"
		} else if (op.action === "update") {
			action = "update"
		} else if (op.action === "delete") {
			action = "delete"
		} else {
			continue
		}

		operations.push({
			action,
			collection,
			rkey,
			// record: op.cid ? null : undefined, // We'll extract the actual record from blocks if needed
		})
	}

	return operations
}
