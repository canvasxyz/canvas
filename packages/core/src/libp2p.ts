import { createHash } from "node:crypto"

import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"
import { webSockets } from "@libp2p/websockets"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { kadDHT } from "@libp2p/kad-dht"
import { isLoopback } from "@libp2p/utils/multiaddr/is-loopback"
import { isPrivate } from "@libp2p/utils/multiaddr/is-private"
import { Multiaddr, multiaddr } from "@multiformats/multiaddr"

import { toHex } from "./utils.js"

const bootstrapList = [
	"/ip4/137.66.12.223/tcp/4002/ws/p2p/12D3KooWP4DLJuVUKoThfzYugv8c326MuM2Tx38ybvEyDjLQkE2o",
	"/ip4/137.66.11.73/tcp/4002/ws/p2p/12D3KooWRftkCBMtYou4pM3VKdqkKVDAsWXnc8NabUNzx7gp7cPT",
	"/ip4/137.66.27.235/tcp/4002/ws/p2p/12D3KooWPopNdRnzswSd8oVxrUBKGhgKzkYALETK7EHkToy7DKk3",
]

const IPColocationFactorWhitelist = new Set(
	bootstrapList.map(multiaddr).map((multiaddr) => multiaddr.nodeAddress().address)
)

const announceFilter = (multiaddrs: Multiaddr[]) =>
	multiaddrs.filter((multiaddr) => !isLoopback(multiaddr) && !isPrivate(multiaddr))

const denyDialMultiaddr = async (peerId: PeerId, multiaddr: Multiaddr) => isLoopback(multiaddr)

export function getLibp2pInit(peerId: PeerId, port?: number, announce?: string[]): Libp2pOptions {
	const announceAddresses =
		announce ?? bootstrapList.map((multiaddr) => `${multiaddr}/p2p-circuit/p2p/${peerId.toString()}`)

	const listenAddresses: string[] = []
	if (port !== undefined) {
		listenAddresses.push(`/ip4/0.0.0.0/tcp/${port}/ws`)
	}

	return {
		connectionGater: { denyDialMultiaddr },
		peerId: peerId,
		addresses: { listen: listenAddresses, announce: announceAddresses, announceFilter },
		transports: [webSockets()],
		connectionEncryption: [noise()],
		streamMuxers: [mplex()],
		peerDiscovery: [bootstrap({ list: bootstrapList })],
		dht: kadDHT({ protocolPrefix: "/canvas", clientMode: false }),
		metrics: { enabled: true },
		pubsub: gossipsub({
			doPX: true,
			fallbackToFloodsub: false,
			allowPublishToZeroPeers: true,
			globalSignaturePolicy: "StrictSign",
			msgIdFn: (msg) => createHash("sha256").update(msg.data).digest(),
			msgIdToStrFn: (id) => toHex(id),
			fastMsgIdFn: (msg) => {
				const hash = createHash("sha256")
				hash.update(msg.data || new Uint8Array([]))
				return "0x" + hash.digest("hex")
			},
			scoreParams: { IPColocationFactorWhitelist },
		}),
	}
}
