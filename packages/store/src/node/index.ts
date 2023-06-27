import type { Libp2p } from "@libp2p/interface-libp2p"
import type { PubSub } from "@libp2p/interface-pubsub"
import type { PeerId } from "@libp2p/interface-peer-id"

import type { KeyValueStore, Source, Target } from "@canvas-js/okra"
import { Tree } from "@canvas-js/okra-node"

import { AbstractStore, Store, StoreInit } from "../store.js"

class NodeStore<T, I = T> extends AbstractStore<T, I> {
	public static async open<T, I = T>(
		libp2p: Libp2p<{ pubsub: PubSub }>,
		{ path, ...init }: StoreInit<T, I> & { path: string }
	): Promise<NodeStore<T, I>> {
		const tree = new Tree(path)
		const store = new NodeStore<T, I>(libp2p, init, tree)
		store.controller.signal.addEventListener("abort", () => tree.close())
		return store
	}

	public constructor(libp2p: Libp2p<{ pubsub: PubSub }>, init: StoreInit<T, I>, private readonly tree: Tree) {
		super(libp2p, init)
	}

	protected async read(targetPeerId: PeerId, callback: (txn: Source) => Promise<void>) {
		await this.tree.read((txn) => callback(txn))
	}

	protected async write(
		sourcePeerId: PeerId,
		callback: (txn: Target & Pick<KeyValueStore, "get" | "set" | "delete">) => Promise<void>
	) {
		await this.tree.write((txn) => callback(txn))
	}
}

export const openStore = <T>(
	libp2p: Libp2p<{ pubsub: PubSub }>,
	init: StoreInit<T> & { path: string }
): Promise<Store<T>> => NodeStore.open(libp2p, init)
