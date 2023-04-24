import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"

import { ethers } from "ethers"

import { exportToProtobuf, createFromProtobuf, createEd25519PeerId } from "@libp2p/peer-id-factory"

import { circuitRelayTransport } from "libp2p/circuit-relay"
import { webSockets } from "@libp2p/websockets"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery"

import { defaultBootstrapList } from "@canvas-js/core/bootstrap"
import { assert } from "@canvas-js/core/utils"
import {
	DIAL_CONCURRENCY,
	DIAL_CONCURRENCY_PER_PEER,
	MIN_CONNECTIONS,
	MAX_CONNECTIONS,
	PEER_ID_FILENAME,
	PUBSUB_DISCOVERY_REFRESH_INTERVAL,
	PUBSUB_DISCOVERY_TOPIC,
	PING_TIMEOUT,
} from "@canvas-js/core/constants"

import type { P2PConfig } from "../types.js"
import { getBaseLibp2pOptions } from "../options.js"

export async function getLibp2pOptions(peerId: PeerId, config: P2PConfig): Promise<Libp2pOptions> {
	assert((config.listen?.length ?? 0) === 0, "listen addresses not supported in the browser")
	assert((config.announce?.length ?? 0) === 0, "announce addresses not supported in the browser")

	return getBaseLibp2pOptions(peerId, config)
}

export async function getPeerId(directory: string | null): Promise<PeerId> {
	assert(directory !== null)

	const localStorageKey = `canvas:${directory}/${PEER_ID_FILENAME}`
	const item = localStorage.getItem(localStorageKey)
	if (item === null) {
		const peerId = await createEd25519PeerId()
		const privateKey = exportToProtobuf(peerId)
		localStorage.setItem(localStorageKey, ethers.utils.base64.encode(privateKey))
		console.log(`[canvas-core] [p2p] Created new peer id ${peerId}`)
		return peerId
	} else {
		const peerId = await createFromProtobuf(ethers.utils.base64.decode(item))
		console.log(`[canvas-core] [p2p] Found existing peer id ${peerId}`)
		return peerId
	}
}
