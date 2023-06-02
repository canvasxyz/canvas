import type { Libp2p } from "@libp2p/interface-libp2p"
import type { PubSub } from "@libp2p/interface-pubsub"
import type { PeerId } from "@libp2p/interface-peer-id"

import type { KeyValueStore, Source, Target } from "@canvas-js/okra"
import { Tree } from "@canvas-js/okra-node"

import { AbstractStore, Store, StoreInit } from "../store.js"

class NodeStore extends AbstractStore {
	public static async open(
		libp2p: Libp2p<{ pubsub: PubSub }>,
		{ path, ...init }: StoreInit & { path: string }
	): Promise<NodeStore> {
		const tree = new Tree(path)
		const store = new NodeStore(libp2p, init, tree)
		store.controller.signal.addEventListener("abort", () => tree.close())
		return store
	}

	public constructor(libp2p: Libp2p<{ pubsub: PubSub }>, init: StoreInit, private readonly tree: Tree) {
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

export const openStore = (libp2p: Libp2p<{ pubsub: PubSub }>, init: StoreInit & { path: string }): Promise<Store> =>
	NodeStore.open(libp2p, init)
