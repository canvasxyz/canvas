import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from "@libp2p/peer-id-factory"
import { PeerId } from "@libp2p/interface-peer-id"
import { base64 } from "multiformats/bases/base64"

import { ModelDB } from "@canvas-js/modeldb-idb"
import { BrowserStore } from "@canvas-js/store/browser"

import type { PlatformTarget } from "../interface.js"

export default function getBrowserTarget(location: string | null): PlatformTarget {
	return {
		async getPeerId(): Promise<PeerId> {
			if (location === null) {
				return await createEd25519PeerId()
			}

			const localStorageKey = `canvas:${location}/peer-id`
			const item = localStorage.getItem(localStorageKey)
			if (item === null) {
				const peerId = await createEd25519PeerId()
				const privateKey = exportToProtobuf(peerId)
				localStorage.setItem(localStorageKey, base64.baseEncode(privateKey))
				console.log(`[canvas-core] Created new peer id ${peerId}`)
				return peerId
			} else {
				const peerId = await createFromProtobuf(base64.baseDecode(item))
				console.log(`[canvas-core] Found existing peer id ${peerId}`)
				return peerId
			}
		},

		async openDB(name, init, options) {
			const databaseName = location === null ? name : `${location}/${name}`
			return await ModelDB.initialize(init, { ...options, databaseName })
		},

		async openStore(init) {
			const name = location === null ? init.topic : `${location}/${init.topic}`
			return await BrowserStore.open(name, init)
		},

		extendLibp2pOptions(options) {
			return options
		},
	}
}
