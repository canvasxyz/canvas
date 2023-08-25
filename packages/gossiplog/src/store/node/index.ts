import path from "node:path"

import type { PeerId } from "@libp2p/interface-peer-id"

import { Tree } from "@canvas-js/okra-node"

import { openStore as openMemoryStore } from "../memory/index.js"

import { AbstractStore, StoreInit, ReadOnlyTransaction, ReadWriteTransaction } from "../AbstractStore.js"

export { AbstractStore, StoreInit, Graph } from "../AbstractStore.js"

export async function openStore(init: StoreInit): Promise<AbstractStore> {
	if (init.location === null) {
		return openMemoryStore(init)
	}

	const tree = new Tree(path.resolve(init.location, init.topic))
	return new Store(init, tree)
}

class Store extends AbstractStore {
	public constructor(init: StoreInit, private readonly tree: Tree) {
		super(init)
	}

	public async close() {
		await this.tree.close()
	}

	public async source(targetPeerId: PeerId, callback: (txn: ReadOnlyTransaction) => Promise<void>) {
		await this.tree.read((txn) => callback(txn))
	}

	public async target(sourcePeerId: PeerId, callback: (txn: ReadWriteTransaction) => Promise<void>): Promise<void> {
		await this.tree.write((txn) => callback(txn))
	}

	public async read<T>(callback: (txn: ReadOnlyTransaction) => Promise<T>) {
		return await this.tree.read((txn) => callback(txn))
	}

	public async write<T>(callback: (txn: ReadWriteTransaction) => Promise<T>): Promise<T> {
		return await this.tree.write((txn) => callback(txn))
	}
}
