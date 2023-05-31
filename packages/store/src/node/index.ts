import { Libp2p } from "@libp2p/interface-libp2p"
import { PubSub } from "@libp2p/interface-pubsub"
import { PeerId } from "@libp2p/interface-peer-id"

import { Tree } from "@canvas-js/okra-node"
import { KeyValueStore, Source, Target } from "@canvas-js/okra"

import { AbstractStore, StoreInit } from "../store.js"

export class Store extends AbstractStore {
	public static async open(libp2p: Libp2p<{ pubsub: PubSub }>, init: StoreInit): Promise<Store> {
		const tree = new Tree("")
		const store = new Store(libp2p, init, tree)
		store.controller.signal.addEventListener("abort", () => tree.close())
		return store
	}

	private readonly incomingSyncPeers = new Set<string>()
	private readonly outgoingSyncPeers = new Set<string>()
	private readonly lockName: string

	public constructor(libp2p: Libp2p<{ pubsub: PubSub }>, init: StoreInit, private readonly tree: Tree) {
		super(libp2p, init)
		this.lockName = `${this.topic}/lock`
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
