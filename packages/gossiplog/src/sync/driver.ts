import { Logger, logger } from "@libp2p/logger"
import { bytesToHex as hex } from "@noble/hashes/utils"

import { Node, Source, Target, equalArrays, equalNodes } from "@canvas-js/okra"

import { assert } from "../utils.js"

export class Driver {
	private readonly log: Logger
	constructor(topic: string, private readonly source: Source, private readonly target: Target) {
		this.log = logger(`canvas:gossiplog:[${topic}]:driver`)
	}

	public async *sync() {
		const [sourceRoot, targetRoot] = await Promise.all([this.source.getRoot(), this.target.getRoot()])
		assert(sourceRoot.key === null, "invalid source root")
		assert(targetRoot.key === null, "invalid target root")

		this.log("source root: level %d, hash %s", sourceRoot.level, hex(sourceRoot.hash))
		this.log("target root: level %d, hash %s", targetRoot.level, hex(targetRoot.hash))

		if (sourceRoot.level === 0) {
			return
		}

		if (equalNodes(sourceRoot, targetRoot)) {
			return
		}

		yield* this.syncRoot(targetRoot.level, sourceRoot)
	}

	private async *syncRoot(targetLevel: number, sourceNode: Node): AsyncGenerator<[key: Uint8Array, value: Uint8Array]> {
		if (sourceNode.level > targetLevel) {
			const children = await this.source.getChildren(sourceNode.level, sourceNode.key)
			if (targetLevel === 0 && sourceNode.level === 1) {
				for (const { level, key, value } of children) {
					if (key === null) {
						continue
					}

					assert(level === 0, "unexpected leaf level")
					assert(value !== undefined, "missing leaf entry value")
					yield [key, value]
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

	private async *syncNode(sourceNode: Node): AsyncGenerator<[key: Uint8Array, value: Uint8Array]> {
		const targetNode = await this.target.getNode(sourceNode.level, sourceNode.key)
		if (targetNode !== null && equalNodes(sourceNode, targetNode)) {
			return
		}

		const children = await this.source.getChildren(sourceNode.level, sourceNode.key)
		if (sourceNode.level > 1) {
			for (const sourceChild of children) {
				yield* this.syncNode(sourceChild)
			}
		} else if (sourceNode.level === 1) {
			for (const { level, key, hash, value } of children) {
				if (key === null) {
					continue
				}

				assert(level === 0, "unexpected leaf level")
				assert(value !== undefined, "missing leaf entry value")

				const leaf = await this.target.getNode(0, key)
				if (leaf === null) {
					try {
						yield [key, value]
					} catch (err) {}
				} else if (equalArrays(hash, leaf.hash)) {
					continue
				} else {
					this.log.error("conflict at key %s", hex(key))
					this.log.error("- target hash: %s", hex(leaf.hash))
					this.log.error("+ source hash: %s", hex(hash))
				}
			}
		}
	}
}
