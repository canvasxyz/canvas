import type { PeerId } from "@libp2p/interface-peer-id"

import { Tree } from "@canvas-js/okra-node"

import { IPLDValue } from "@canvas-js/interfaces"

import { openStore as openMemoryStore } from "../memory/index.js"

import { AbstractGraphStore, GraphStoreInit, ReadOnlyTransaction, ReadWriteTransaction } from "../AbstractGraphStore.js"

export type { AbstractGraphStore, GraphStoreInit } from "../AbstractGraphStore.js"

export async function openStore<I extends IPLDValue>(init: GraphStoreInit<I>): Promise<AbstractGraphStore<I>> {
	if (init.location === null) {
		return openMemoryStore(init)
	}

	const tree = new Tree(init.location)
	return new Store(init, tree)
}

class Store<I extends IPLDValue> extends AbstractGraphStore<I> {
	public constructor(init: GraphStoreInit<I>, private readonly tree: Tree) {
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
