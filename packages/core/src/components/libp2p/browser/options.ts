import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"
import { exportToProtobuf, createFromProtobuf, createEd25519PeerId } from "@libp2p/peer-id-factory"
import { base64 } from "multiformats/bases/base64"

import { assert } from "@canvas-js/core/utils"
// import { PEER_ID_FILENAME } from "@canvas-js/core/constants"

import type { P2PConfig, ServiceMap } from "../types.js"
import { getBaseLibp2pOptions } from "../options.js"

export async function getLibp2pOptions(peerId: PeerId, config: P2PConfig): Promise<Libp2pOptions<ServiceMap>> {
	assert((config.listen?.length ?? 0) === 0, "listen addresses not supported in the browser")
	assert((config.announce?.length ?? 0) === 0, "announce addresses not supported in the browser")
	return getBaseLibp2pOptions(peerId, config)
}

// export async function getPeerId(directory: string | null): Promise<PeerId> {
// 	assert(directory !== null)

// 	const localStorageKey = `canvas:${directory}/${PEER_ID_FILENAME}`
// 	const item = localStorage.getItem(localStorageKey)
// 	if (item === null) {
// 		const peerId = await createEd25519PeerId()
// 		const privateKey = exportToProtobuf(peerId)
// 		localStorage.setItem(localStorageKey, base64.baseEncode(privateKey))
// 		console.log(`[canvas-core] Created new peer id ${peerId}`)
// 		return peerId
// 	} else {
// 		const peerId = await createFromProtobuf(base64.baseDecode(item))
// 		console.log(`[canvas-core] Found existing peer id ${peerId}`)
// 		return peerId
// 	}
// }
