import { Logger, logger } from "@libp2p/logger"
import { bytesToHex as hex } from "@noble/hashes/utils"
import { equals } from "uint8arrays"

import { Node, SyncSource, ReadOnlyTransaction } from "@canvas-js/okra"
import { assert } from "@canvas-js/utils"
import { CodeError } from "@libp2p/interface"

/**
 * This differs from the sync function exported from @canvas-js/okra in three ways
 * 1) It only yields keys, not entries
 * 2) It assumes that entries are immutable
 * 3) It only yields keys for entries present in `source` and missing in `target`
 */
export class Driver {
	private readonly log: Logger
	constructor(topic: string, private readonly source: SyncSource, private readonly target: ReadOnlyTransaction) {
		this.log = logger(`canvas:gossiplog:[${topic}]:driver`)
	}

	public async *sync(): AsyncGenerator<Uint8Array[]> {
		const [sourceRoot, targetRoot] = await Promise.all([this.source.getRoot(), this.target.getRoot()])
		assert(sourceRoot.key === null, "invalid source root")
		assert(targetRoot.key === null, "invalid target root")

		this.log("source root: level %d, hash %s", sourceRoot.level, hex(sourceRoot.hash))
		this.log("target root: level %d, hash %s", targetRoot.level, hex(targetRoot.hash))

		if (sourceRoot.level === 0) {
			return
		}

		if (sourceRoot.level === targetRoot.level && equals(sourceRoot.hash, targetRoot.hash)) {
			return
		}

		yield* this.syncRoot(targetRoot.level, sourceRoot)
	}

	private async *syncRoot(targetLevel: number, sourceNode: Node): AsyncGenerator<Uint8Array[]> {
		if (sourceNode.level > targetLevel) {
			const children = await this.source.getChildren(sourceNode.level, sourceNode.key)
			if (targetLevel === 0 && sourceNode.level === 1) {
				const keys: Uint8Array[] = []
				for (const { level, key } of children) {
					if (key === null) {
						continue
					}

					assert(level === 0, "unexpected leaf level")
					keys.push(key)
				}

				try {
					yield keys
				} catch (err) {
					this.log.error("failed to process batch: %O", err)
				}
			} else {
				for (const sourceChild of children) {
					yield* this.syncRoot(targetLevel, sourceChild)
				}
			}
		} else {
			yield* this.syncNode(sourceNode)
		}
	}

	private async *syncNode(sourceNode: Node): AsyncGenerator<Uint8Array[]> {
		const targetNode = this.target.getNode(sourceNode.level, sourceNode.key)
		if (targetNode !== null) {
			if (targetNode.level === sourceNode.level && equals(targetNode.hash, sourceNode.hash)) {
				return
			}
		}

		const children = await this.source.getChildren(sourceNode.level, sourceNode.key)
		if (sourceNode.level > 1) {
			for (const sourceChild of children) {
				yield* this.syncNode(sourceChild)
			}
		} else if (sourceNode.level === 1) {
			const keys: Uint8Array[] = []
			for (const { level, key, hash } of children) {
				if (key === null) {
					continue
				}

				assert(level === 0, "unexpected leaf level")

				const leaf = this.target.getNode(0, key)
				if (leaf === null) {
					keys.push(key)
				} else if (equals(hash, leaf.hash)) {
					continue
				} else {
					this.log.error("conflict at key %s", hex(key))
					this.log.error("- target hash: %s", hex(leaf.hash))
					this.log.error("+ source hash: %s", hex(hash))
					throw new CodeError("conflicting values for key", "CONFLICT", {
						source: { level, key, hash },
						target: leaf,
					})
				}
			}

			try {
				yield keys
			} catch (err) {
				this.log.error("failed to process batch: %O", err)
				throw err
			}
		}
	}
}
