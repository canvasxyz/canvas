import { IDBStore } from "@canvas-js/okra-idb"
import { Store } from "@canvas-js/store"
import { openStore } from "@canvas-js/store/browser"
import { GossipsubEvents } from "@chainsafe/libp2p-gossipsub"
import { PubSub } from "@libp2p/interface-pubsub"
import { Libp2p } from "libp2p"
import { PingService } from "libp2p/ping"
import { useEffect, useState } from "react"

type ServiceMap = {
	identify: {}
	pubsub: PubSub<GossipsubEvents>
	ping: PingService
}

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

export const useSubscription = (libp2p: Libp2p<ServiceMap>) => {
	const [stores, setStores] = useState<Record<string, Store>>({})

	// useEffect(() => {
	// 	// automatically stop all of the stores when this hook is unmounted
	// 	return () => {
	// 		console.log("stopping stores")
	// 		Object.values(stores).forEach((store) => store.stop())
	// 	}
	// }, [])

	const register: (
		topic: string,
		apply: (key: Uint8Array, value: Uint8Array) => Promise<void>
	) => Promise<void> = async (topic, apply) => {
		const store = await openStore(libp2p, {
			topic,
			apply,
		})

		try {
			await store.start()
			setStores((stores) => ({ ...stores, [topic]: store }))
		} catch (e) {
			// undo the store creation if it fails to start
			// TODO: what happens if this fails?
			await store.stop()
		}
	}

	const unregister: (topic: string) => Promise<void> = async (topic) => {
		console.log("unregistering store", topic)
		const store = stores[topic]
		if (!store) return

		await store.stop()

		setStores((stores) => {
			const newStores = { ...stores }
			delete newStores[topic]
			return newStores
		})
	}

	const unregisterAll = async () => {
		for (const topic of Object.keys(stores)) {
			await unregister(topic)
		}
	}

	// const insert: (topic: string, key: Uint8Array, value: Uint8Array) => Promise<void> = async (topic, key, value) => {
	// 	const store = stores[topic]
	// 	if (!store) return
	// 	store.insert(key, value)
	// }

	return {
		register,
		unregister,
		unregisterAll,
		stores,
	}
}
