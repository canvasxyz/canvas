import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from "@libp2p/peer-id-factory"
import { PeerId } from "@libp2p/interface-peer-id"
import { base64 } from "multiformats/bases/base64"

import { ModelDB } from "@canvas-js/modeldb/browser"

import type { PlatformTarget } from "../interface.js"

export default function getBrowserTarget(location: string | null): PlatformTarget {
	if (location === null) {
		throw new Error("location value is required in the browser")
	}

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

		async openDB(init, options) {
			const databaseName = `${location}/db`
			return await ModelDB.initialize(databaseName, init, options)
		},

		extendLibp2pOptions(options) {
			return options
		},
	}
}
