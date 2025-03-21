import type { AbstractModelDB, Effect, ModelSchema } from "@canvas-js/modeldb"
import { assert, zip } from "@canvas-js/utils"

import { MessageId } from "./MessageId.js"
import { MessageSet } from "./MessageSet.js"
import { getAncestorClocks } from "./utils.js"

export type AncestorRecord = {
	key: Uint8Array
	clock: number
	links: Uint8Array
}

export class AncestorIndex {
	public static schema = {
		$ancestors: {
			$primary: "key/clock",
			key: "bytes",
			clock: "integer",
			links: "bytes",
		},
	} satisfies ModelSchema

	constructor(private readonly db: AbstractModelDB) {}

	private async getLinks(id: MessageId, atOrBefore: number): Promise<MessageSet> {
		const diff = id.clock - atOrBefore
		const highestBit = 31 - Math.clz32(diff) // Find position of highest set bit
		const clock = id.clock - (1 << highestBit)

		const record = await this.db.get<AncestorRecord>("$ancestors", [id.key, clock])
		if (record === null) {
			throw new Error(`ancestor links not found for ${id} at ${clock}`)
		}

		return MessageSet.decode(record.links)
	}

	public async isAncestor(id: MessageId, ancestorId: MessageId, visited: MessageSet): Promise<boolean> {
		if (id.equals(ancestorId)) {
			return true
		}

		if (id.clock <= ancestorId.clock) {
			return false
		}

		const links = await this.getLinks(id, ancestorId.clock)
		for (const link of links) {
			if (visited.has(link)) {
				continue
			}

			visited.add(link)
			const result = await this.isAncestor(link, ancestorId, visited)
			if (result) {
				return true
			}
		}

		return false
	}

	public async indexAncestors(id: MessageId, parentIds: MessageSet, effects: Effect[]) {
		id = typeof id === "string" ? MessageId.encode(id) : id
		const ancestorClocks = Array.from(getAncestorClocks(id.clock))
		const ancestorLinks: MessageSet[] = new Array(ancestorClocks.length)

		for (const [i, ancestorClock] of ancestorClocks.entries()) {
			if (i === 0) {
				ancestorLinks[i] = parentIds
			} else {
				const links = new MessageSet()
				for (const child of ancestorLinks[i - 1]) {
					if (child.clock <= ancestorClock) {
						links.add(child)
					} else {
						assert(child.clock <= ancestorClocks[i - 1], "expected childClock <= ancestorClocks[i - 1]")
						await this.getAncestors(child, ancestorClock, links)
					}
				}

				ancestorLinks[i] = links
			}
		}

		for (const [clock, links] of zip(ancestorClocks, ancestorLinks)) {
			const value: AncestorRecord = { key: id.key, clock, links: links.encode() }
			effects.push({ model: "$ancestors", operation: "set", value })
		}
	}

	public async getAncestors(
		id: MessageId,
		atOrBefore: number,
		results = new MessageSet(),
		visited = new MessageSet(),
	): Promise<MessageSet> {
		assert(atOrBefore > 0, "expected atOrBefore > 0")
		assert(atOrBefore < id.clock, "expected atOrBefore < clock")

		const links = await this.getLinks(id, atOrBefore)
		for (const ancestor of links) {
			if (ancestor.clock <= atOrBefore) {
				results.add(ancestor)
			} else if (visited.has(ancestor)) {
				break
			} else {
				visited.add(ancestor)
				await this.getAncestors(ancestor, atOrBefore, results, visited)
			}
		}

		return results
	}
}
