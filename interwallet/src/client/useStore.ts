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
	;(window as any).libp2p = libp2p
	const [stores, setStores] = useState<Record<string, Store>>({})

	const register: (
		topic: string,
		apply: (key: Uint8Array, value: Uint8Array) => Promise<void>
	) => Promise<void> = async (topic, apply) => {
		console.log("registering store", topic)
		const store = await openStore(libp2p, {
			topic,
			apply,
		})

		try {
			await store.start()
			setStores((stores) => ({ ...stores, [topic]: store }))
		} catch (e) {
			console.log(e)
		}
	}

	const unregister: (topic: string) => Promise<void> = async (topic) => {
		console.log("unregistering store", topic)
		const store = stores[topic]
		if (!store) return

		await store.stop()

		await Dexie.delete(topic)

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

	return {
		register,
		unregister,
		unregisterAll,
		stores,
	}
}

export const useSubscription2 = (
	libp2p: Libp2p<ServiceMap>,
	configs: Record<
		string,
		{
			// topic: string
			apply: (key: Uint8Array, value: Uint8Array) => Promise<void>
			// partition: string[]
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

	const configsKey = JSON.stringify(Object.keys(configs))

	useEffect(() => {
		// only sync stores once for a given set of configs
		if (registeredStoreKeys.current === configsKey) return
		registeredStoreKeys.current = configsKey

		syncStores(configs)
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
