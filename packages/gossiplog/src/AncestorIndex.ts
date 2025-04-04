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

	private async getLinks(messageId: MessageId, atOrBefore: number): Promise<MessageSet> {
		const delta = messageId.clock - atOrBefore
		const index = delta <= 0xffffffff ? 0x1f - Math.clz32(delta) : Math.floor(Math.log2(delta))
		const clock = messageId.clock - (1 << index)

		const record = await this.db.get<AncestorRecord>("$ancestors", [messageId.key, clock])
		if (record === null) {
			throw new Error(`ancestor links not found for ${messageId} at ${clock}`)
		}

		return MessageSet.decode(record.links)
	}

	public async isAncestor(messageId: MessageId, ancestorId: MessageId, visited: MessageSet): Promise<boolean> {
		if (messageId.equals(ancestorId)) {
			return true
		}

		if (messageId.clock <= ancestorId.clock) {
			return false
		}

		const links = await this.getLinks(messageId, ancestorId.clock)
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

	public async indexAncestors(messageId: MessageId, parentIds: MessageSet, effects: Effect[]) {
		messageId = typeof messageId === "string" ? MessageId.encode(messageId) : messageId
		const ancestorClocks = Array.from(getAncestorClocks(messageId.clock))
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
			const value: AncestorRecord = { key: messageId.key, clock, links: links.encode() }
			effects.push({ model: "$ancestors", operation: "set", value })
		}
	}

	public async getAncestors(
		messageId: MessageId,
		atOrBefore: number,
		results = new MessageSet(),
		visited = new MessageSet(),
	): Promise<MessageSet> {
		assert(atOrBefore > 0, "expected atOrBefore > 0")
		assert(atOrBefore < messageId.clock, "expected atOrBefore < clock")

		const links = await this.getLinks(messageId, atOrBefore)
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
