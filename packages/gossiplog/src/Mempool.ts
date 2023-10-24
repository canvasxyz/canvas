import { logger } from "@libp2p/logger"

import { assert } from "./utils.js"

export class Mempool<T> {
	// TODO: add capacity
	// public static defaultCapacity = 100

	readonly log = logger("canvas:gossiplog:mempool")

	readonly values = new Map<string, T>()

	/** `missingParents` stores the missing parents "blocking" each message in `messages` */
	readonly missingParents = new Map<string, Set<string>>()

	/**
	 * When we observe a value, we need to look up any mempool entries which
	 * depended on that value that are now eligible for application themselves.
	 * `waitingChildren` is a map from the parent ids of all mempool entries
	 * (ie the union of all the sets in `missingParents`) to the set of children
	 * (ie keys in `missingParents`) that depend on them.
	 */
	readonly waitingChildren = new Map<string, Set<string>>()

	public constructor() {}

	public add(id: string, value: T, missingParents: Set<string>) {
		this.values.set(id, value)
		this.missingParents.set(id, missingParents)

		for (const parent of missingParents) {
			const children = this.waitingChildren.get(parent)
			if (children === undefined) {
				this.waitingChildren.set(parent, new Set([id]))
			} else {
				children.add(id)
			}
		}
	}

	/**
	 * This is called for every message added to the log (both appends and inserts).
	 * It removes all references to the inserted message and returns a set of "unblocked" messages.
	 */
	public *observe(id: string): Iterable<[id: string, value: T]> {
		const children = this.waitingChildren.get(id)
		this.log("observing %s with %d children %o", id, children?.size ?? 0, children)

		if (children === undefined) {
			return []
		}

		this.waitingChildren.delete(id)

		for (const child of children) {
			const missingParents = this.missingParents.get(child)
			assert(missingParents !== undefined, "expected missingParents !== undefined")

			missingParents.delete(id)
			if (missingParents.size === 0) {
				const value = this.values.get(child)
				assert(value !== undefined, "expected value !== undefined")

				this.values.delete(child)
				this.missingParents.delete(child)

				yield [child, value]
			}
		}
	}
}
