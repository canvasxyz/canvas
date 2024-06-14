import { equals, fromString, toString } from "uint8arrays"

import { Node, Key } from "@canvas-js/okra"
import { AbstractModelDB, Effect, RangeExpression } from "@canvas-js/modeldb"
import { assert } from "@canvas-js/utils"
import { MAX_MESSAGE_ID, MIN_MESSAGE_ID, encodeId } from "./ids.js"

type NodeRecord = { id: string; hash: Uint8Array }

export class MerkleIndex {
	public constructor(readonly db: AbstractModelDB) {}

	public async *entries(options: { pageSize?: number } = {}): AsyncIterable<[Uint8Array, { hash: Uint8Array }]> {
		let lowerBound: RangeExpression = { gte: MIN_MESSAGE_ID }
		while (true) {
			const results = await this.db.query<{ id: string; hash: Uint8Array }>("$messages", {
				orderBy: { id: "asc" },
				select: { id: true, hash: true },
				where: { id: lowerBound },
				limit: options.pageSize ?? 4096,
			})

			if (results.length === 0) {
				break
			}

			for (const { id, hash } of results) {
				yield [encodeId(id), { hash }]
			}

			lowerBound = { gt: results[results.length - 1].id }
		}
	}

	// async commit(root: Node) {
	// 	const ids = await this.db.query<NodeRecord>("$nodes", { select: { id: true } })

	// 	await this.db.apply([
	// 		...ids.map<Effect>(({ id }) => ({ model: "$nodes", operation: "delete", key: id })),
	// 		{ model: "$nodes", operation: "set", value: MerkleIndex.encodeNode(root) },
	// 	])
	// }

	// async getRoot(): Promise<Node> {
	// 	const nodes = await this.db.query<NodeRecord>("messages", { orderBy: { id: "desc" }, limit: 1 })

	// 	assert(nodes.length === 1)
	// 	const root = MerkleIndex.decodeNode(nodes[0])

	// 	assert(root.key === null)
	// 	return root
	// }

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
