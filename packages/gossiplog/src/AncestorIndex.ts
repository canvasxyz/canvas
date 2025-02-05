import type { AbstractModelDB, ModelSchema } from "@canvas-js/modeldb"
import { assert } from "@canvas-js/utils"

import { decodeClock } from "./clock.js"
import { encodeId, MessageId } from "./ids.js"
import { getAncestorClocks } from "./utils.js"

export type AncestorRecord = { id: string; links: string[][] }

export class AncestorIndex {
	public static schema = {
		$ancestors: { id: "primary", links: "json" },
	} satisfies ModelSchema

	constructor(private readonly db: AbstractModelDB) {}

	private async getLinks(id: string | MessageId): Promise<string[][]> {
		const key = typeof id === "string" ? id : id.id
		const record = await this.db.get<AncestorRecord>("$ancestors", key)
		if (record === null) {
			throw new Error(`ancestor links not found for ${key}`)
		}

		return record.links
	}

	private async setLinks(id: string | MessageId, links: string[][]): Promise<void> {
		const key = typeof id === "string" ? id : id.id
		await this.db.set<AncestorRecord>("$ancestors", { id: key, links })
	}

	public async isAncestor(
		id: string | MessageId,
		ancestorId: string | MessageId,
		visited: Set<string>,
	): Promise<boolean> {
		id = typeof id === "string" ? MessageId.encode(id) : id
		ancestorId = typeof ancestorId === "string" ? MessageId.encode(ancestorId) : ancestorId

		if (id.equals(ancestorId)) {
			return true
		}

		if (id.clock <= ancestorId.clock) {
			return false
		}

		const links = await this.getLinks(id)
		const index = Math.floor(Math.log2(id.clock - ancestorId.clock))
		for (const link of links[index]) {
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

	public async indexAncestors(id: string, parentIds: string[]) {
		const key = encodeId(id)
		const [clock] = decodeClock(key)
		const ancestorClocks = Array.from(getAncestorClocks(clock))
		const ancestorLinks: string[][] = new Array(ancestorClocks.length)

		for (const [i, ancestorClock] of ancestorClocks.entries()) {
			if (i === 0) {
				ancestorLinks[i] = parentIds
			} else {
				const links = new Set<string>()
				for (const childId of ancestorLinks[i - 1]) {
					const childKey = encodeId(childId)
					const [childClock] = decodeClock(childKey)
					if (childClock <= ancestorClock) {
						links.add(childId)
					} else {
						assert(childClock <= ancestorClocks[i - 1], "expected childClock <= ancestorClocks[i - 1]")
						await this.getAncestors(childId, ancestorClock, links)
					}
				}

				ancestorLinks[i] = Array.from(links).sort()
			}
		}

		await this.setLinks(id, ancestorLinks)
	}

	public async getAncestors(
		id: string,
		atOrBefore: number,
		results = new Set<string>(),
		visited = new Set<string>(),
	): Promise<Set<string>> {
		assert(atOrBefore > 0, "expected atOrBefore > 0")

		const key = encodeId(id)
		const [clock] = decodeClock(key)
		assert(atOrBefore < clock, "expected atOrBefore < clock")

		const index = Math.floor(Math.log2(clock - atOrBefore))

		const links = await this.getLinks(id)
		for (const ancestorId of links[index]) {
			const ancestorKey = encodeId(ancestorId)
			const [ancestorClock] = decodeClock(ancestorKey)

			if (ancestorClock <= atOrBefore) {
				results.add(ancestorId)
			} else if (visited.has(ancestorId)) {
				break
			} else {
				visited.add(ancestorId)
				await this.getAncestors(ancestorId, atOrBefore, results, visited)
			}
		}

		return results
	}
}
