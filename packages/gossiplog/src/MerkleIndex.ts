import { fromString, toString } from "uint8arrays"
import { logger } from "@libp2p/logger"

import { Node, Key } from "@canvas-js/okra"
import { AbstractModelDB, RangeExpression } from "@canvas-js/modeldb"
import { MIN_MESSAGE_ID, encodeId } from "./MessageId.js"

type NodeRecord = { id: string; hash: Uint8Array }

export class MerkleIndex {
	public static defaultPageSize = 4096

	private readonly log = logger("canvas:gossiplog:merkle-index")

	public constructor(readonly db: AbstractModelDB) {}

	public async *entries(options: { pageSize?: number } = {}): AsyncIterable<[Uint8Array, { hash: Uint8Array }]> {
		this.log("iterating over all entries")

		let lowerBound: RangeExpression = { gte: MIN_MESSAGE_ID }

		while (true) {
			this.log("fetching new page")
			const results = await this.db.query<{ id: string; hash: string }>("$messages", {
				orderBy: { id: "asc" },
				select: { id: true, hash: true },
				where: { id: lowerBound },
				limit: options.pageSize ?? MerkleIndex.defaultPageSize,
			})

			this.log("got new page of %d records", results.length)

			if (results.length === 0) {
				break
			}

			for (const { id, hash } of results) {
				yield [encodeId(id), { hash: fromString(hash, "hex") }]
			}

			lowerBound = { gt: results[results.length - 1].id }
		}

		this.log("finished iterating")
	}

	private static encodeNodeId = (level: number, key: Key) => {
		const l = level.toString(16).padStart(2, "0")
		if (key === null) {
			return l
		} else {
			const k = toString(key, "hex")
			return `${l}:${k}`
		}
	}

	private static encodeNode = (node: Node): NodeRecord => {
		const id = MerkleIndex.encodeNodeId(node.level, node.key)
		return { id, hash: node.hash }
	}

	private static decodeNode = ({ id, hash }: NodeRecord): Node => {
		const [l, k] = id.split(":")
		const level = parseInt(l, 16)
		const key = k ? fromString(k, "hex") : null
		return { level, key, hash }
	}
}
