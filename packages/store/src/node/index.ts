import type { PeerId } from "@libp2p/interface-peer-id"

import type { KeyValueStore, Source, Target, Node } from "@canvas-js/okra"
import { Tree } from "@canvas-js/okra-node"

import { AbstractStore } from "../AbstractStore.js"
import { IPLDValue, Store, StoreInit } from "../interface.js"

export class NodeStore<T extends IPLDValue> extends AbstractStore<T> {
	public static async open<T extends IPLDValue>(path: string, init: StoreInit<T>): Promise<NodeStore<T>> {
		const tree = new Tree(path)
		const store = new NodeStore<T>(tree, init)
		store.controller.signal.addEventListener("abort", () => tree.close())
		return store
	}

	public constructor(private readonly tree: Tree, init: StoreInit<T>) {
		super(init)
	}

	protected async read(targetPeerId: PeerId, callback: (txn: Source) => Promise<void>) {
		await this.tree.read((txn) => callback(txn))
	}

	protected async write(
		sourcePeerId: PeerId,
		callback: (txn: Target & Pick<KeyValueStore, "get" | "set" | "delete">) => Promise<void>
	): Promise<{ root: Node }> {
		const root = await this.tree.write(async (txn) => {
			await callback(txn)
			return txn.getRoot()
		})

		return { root }
	}
}

export const openStore = <T extends IPLDValue>(path: string, init: StoreInit<T>): Promise<Store<T>> =>
	NodeStore.open(path, init)
