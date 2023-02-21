import path from "node:path"
import fs from "node:fs"

import PQueue from "p-queue"
import { Tree, Transaction } from "@canvas-js/okra-node"

import { Message } from "@canvas-js/interfaces"

import { getMessageKey } from "./rpc/index.js"
import { MST_DIRECTORY_NAME } from "./constants.js"
import { toHex } from "./utils.js"

export class MST {
	private readonly tree: Tree
	private readonly queue = new PQueue({ concurrency: 1 })

	public readonly roots: Record<string, string> = {}

	public static async initialize(
		directory: string,
		dbs: string[],
		importMessages: (dbi: string) => AsyncIterable<[Buffer, Message]>,
		options: { verbose?: boolean } = {}
	) {
		const treePath = path.resolve(directory, MST_DIRECTORY_NAME)
		if (options.verbose) {
			console.log(`[canvas-core] Initializing MST index at ${treePath}`)
		}

		if (fs.existsSync(treePath)) {
			return new MST(treePath, dbs)
		} else {
			fs.mkdirSync(treePath)
			const mst = new MST(treePath, dbs)
			for (const dbi of dbs) {
				await mst.write(dbi, async (txn) => {
					for await (const [hash, message] of importMessages(dbi)) {
						txn.set(getMessageKey(hash, message), hash)
					}
				})
			}

			return mst
		}
	}

	private constructor(treePath: string, public readonly dbs: string[]) {
		this.tree = new Tree(treePath, { dbs })
	}

	public async read<T = void>(dbi: string, callback: (txn: Transaction) => T | Promise<T>): Promise<T> {
		const txn = new Transaction(this.tree, true, { dbi })
		try {
			return await callback(txn)
		} finally {
			txn.abort()
		}
	}

	public async write(dbi: string, callback: (txn: Transaction) => void | Promise<void>) {
		await this.queue.add(async () => {
			const txn = new Transaction(this.tree, false, { dbi })

			try {
				await callback(txn)
				const { hash } = txn.getRoot()
				this.roots[dbi] = toHex(hash)
			} catch (err) {
				txn.abort()
				throw err
			}

			txn.commit()
		})
	}

	public async close() {
		await this.queue.onIdle()
		this.tree.close()
	}
}
