import { CarReader } from "@ipld/car"
import * as cbor from "@ipld/dag-cbor"
import { CID } from "multiformats"

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

export const parseCarFile = async function(carBytes: Uint8Array, log?: (message: string, ...args: any[]) => void): Promise<Array<{ collection: string; rkey: string; record: any }>> {
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