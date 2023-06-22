import { IDBStore } from "@canvas-js/okra-idb"
import { Store } from "@canvas-js/store"
import { openStore } from "@canvas-js/store/browser"
import { GossipsubEvents } from "@chainsafe/libp2p-gossipsub"
import { PubSub } from "@libp2p/interface-pubsub"
import Dexie from "dexie"
import { Libp2p } from "libp2p"
import { PingService } from "libp2p/ping"
import _ from "lodash"
import { useEffect, useRef, useState } from "react"

type ServiceMap = {
	identify: {}
	pubsub: PubSub<GossipsubEvents>
	ping: PingService
}

export const makeShardedTopic = (topic: string, shard: string) => `${topic}:${shard}`

export const useStore = (
	libp2p: Libp2p<ServiceMap>,
	{ topic, apply }: { topic: string; apply: (key: Uint8Array, value: Uint8Array) => Promise<void> }
) => {
	const [store, setStore] = useState<Store | null>(null)

	useEffect(() => {
		openStore(libp2p, {
			topic,
			apply,
		}).then((store) => {
			setStore(store)
		})

		return () => {
			if (store) store.stop()
		}
	}, [])

	return { store }
}

export const useSubscriptions = (
	libp2p: Libp2p<ServiceMap>,
	configs: Record<
		string,
		| {
				apply: (key: Uint8Array, value: Uint8Array) => Promise<void>
		  }
		| {
				shards: string[]
				apply: (key: Uint8Array, value: Uint8Array, context: { shard: string }) => Promise<void>
		  }
	>
) => {
	const [stores, setStores] = useState<Record<string, Store>>({})

	const registeredStoreKeys = useRef<string>("")

	const syncStores = async (configs: Record<string, any>) => {
		const newStores: Record<string, Store> = { ...stores }

		// find stores to unregister
		const storesToUnregister = _.difference(Object.keys(stores), Object.keys(configs))
		console.log("stores to unregister", storesToUnregister)
		for (const topic of storesToUnregister) {
			console.log("unregistering store", topic)
			const store = stores[topic]
			if (!store) return

			await store.stop()
			await Dexie.delete(topic)

			delete newStores[topic]
		}

		// find stores to register
		const storesToRegister = _.difference(Object.keys(configs), Object.keys(stores))
		console.log("stores to register", storesToRegister)
		for (const topic of storesToRegister) {
			console.log("registering store", topic)
			const config = configs[topic]
			if (!config) return

			const store = await openStore(libp2p, { topic, apply: config.apply })
			await store.start()
			newStores[topic] = store
		}

		setStores(newStores)
	}

	// for all of the configs that have shards, turn them into multiple configs
	const reifiedConfigs: Record<string, { apply: (key: Uint8Array, value: Uint8Array) => void }> = {}
	for (const topic of Object.keys(configs)) {
		const config = configs[topic]
		if ("shards" in config) {
			for (const shard of config.shards) {
				const resolvedTopic = makeShardedTopic(topic, shard)
				// pass the shard to the apply function
				reifiedConfigs[resolvedTopic] = {
					apply: (key: Uint8Array, value: Uint8Array) => config.apply(key, value, { shard }),
				}
			}
		} else {
			reifiedConfigs[topic] = config
		}
	}

	const configsKey = JSON.stringify(Object.keys(reifiedConfigs))

	useEffect(() => {
		// only sync stores once for a given set of configs
		if (registeredStoreKeys.current === configsKey) return
		registeredStoreKeys.current = configsKey

		syncStores(reifiedConfigs)
	}, [configsKey])

	const unregisterAll = async () => {
		console.log("unregistering all stores")

		return Object.keys(stores).map(async (topic) => {
			const store = stores[topic]
			if (!store) return
			await store.stop()
			await Dexie.delete(topic)
		})
	}

	return { stores, unregisterAll }
}
