import { Message } from "@canvas-js/interfaces"
import { Signature } from "@canvas-js/signed-cid"

export class Mempool<Payload> {
	// public static defaultCapacity = 100

	/**
	 * `messages` stores entries just like the message database,
	 * with encoded message ids as keys and messages as values.
	 */
	readonly messages = new Map<string, { signature: Signature | null; message: Message<Payload> }>()

	/**
	 * `dependencies` stores the missing parents of the entries in `messages`.
	 */
	readonly dependencies = new Map<string, Set<string>>()

	/**
	 * When we apply any message, we need to look up any mempool entries that
	 * depended on that message that are now eligible for application themselves.
	 * `children` is a map from the parent ids of all mempool
	 * entries to the set of children that depend on them.
	 */
	readonly children = new Map<string, Set<string>>()

	public constructor() {}
}
