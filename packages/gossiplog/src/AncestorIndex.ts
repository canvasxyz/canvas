import type { AbstractModelDB, Effect, ModelSchema } from "@canvas-js/modeldb"
import { assert } from "@canvas-js/utils"

import { decodeClock } from "./clock.js"
import { encodeId, MessageId } from "./MessageId.js"
import { getAncestorClocks } from "./utils.js"
import { MessageSet } from "./MessageSet.js"

export type AncestorRecord = { id: string; links: string[][] }

export class AncestorIndex {
	public static schema = {
		$ancestors: { id: "primary", links: "json" },
	} satisfies ModelSchema

	constructor(private readonly db: AbstractModelDB) {}

	private async getLinks(messageId: MessageId, atOrBefore: number): Promise<MessageSet> {
		const index = Math.floor(Math.log2(messageId.clock - atOrBefore))

		const record = await this.db.get<AncestorRecord>("$ancestors", messageId.id)
		if (record === null) {
			throw new Error(`ancestor links not found for ${messageId}`)
		}

		return new MessageSet(record.links[index].map(MessageId.encode))
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

		const value: AncestorRecord = {
			id: messageId.id,
			links: ancestorLinks.map((links) => Array.from(links).map((link) => link.id)),
		}

		effects.push({ model: "$ancestors", operation: "set", value })
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
