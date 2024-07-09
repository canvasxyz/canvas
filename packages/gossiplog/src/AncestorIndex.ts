import type { AbstractModelDB, ModelSchema } from "@canvas-js/modeldb"
import { assert } from "@canvas-js/utils"

import { decodeClock } from "./clock.js"
import { encodeId } from "./ids.js"
import { getAncestorClocks } from "./utils.js"

export class AncestorIndex {
	public static schema = {
		$ancestors: { id: "primary", links: "json" },
	} satisfies ModelSchema

	constructor(private readonly db: AbstractModelDB) {}

	private async getLinks(id: string): Promise<string[][]> {
		const record = await this.db.get<{ id: string; links: string[][] }>("$ancestors", id)
		if (record === null) {
			throw new Error(`ancestor links not found for ${id}`)
		}

		return record.links
	}

	private async setLinks(id: string, links: string[][]): Promise<void> {
		await this.db.set<{ id: string; links: string[][] }>("$ancestors", { id, links })
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

	public async isAncestor(id: string, ancestorId: string, visited = new Set<string>()): Promise<boolean> {
		if (id === ancestorId) {
			return true
		}

		const key = encodeId(id)
		const [clock] = decodeClock(key)

		const ancestorKey = encodeId(ancestorId)
		const [ancestorClock] = decodeClock(ancestorKey)

		if (clock <= ancestorClock) {
			return false
		}

		const links = await this.getLinks(id)
		const index = Math.floor(Math.log2(clock - ancestorClock))
		for (const id of links[index]) {
			if (visited.has(id)) {
				continue
			}

			visited.add(id)
			const result = await this.isAncestor(id, ancestorId, visited)
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
}
