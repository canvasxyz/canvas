import type { ExecutionContext } from "ava"

import { Libp2p, createLibp2p } from "libp2p"
import { identifyService } from "libp2p/identify"
import { plaintext } from "libp2p/insecure"

import { tcp } from "@libp2p/tcp"

import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub, GossipSub } from "@chainsafe/libp2p-gossipsub"

import type { PeerId } from "@libp2p/interface-peer-id"
import { createEd25519PeerId } from "@libp2p/peer-id-factory"
import { logger } from "@libp2p/logger"

export type NetworkInit = Record<string, { port: number; peers: string[] }>

const getAddress = (port: number) => `/ip4/127.0.0.1/tcp/${port}`

export async function createNetwork(
	t: ExecutionContext<unknown>,
	init: NetworkInit,
	options: { start?: boolean; minConnections?: number; maxConnections?: number } = {}
): Promise<Record<string, Libp2p<{ pubsub: GossipSub }>>> {
	const names = Object.keys(init)

	const peerIds = await Promise.all(
		names.map<Promise<[string, PeerId]>>(async (name) => {
			const peerId = await createEd25519PeerId()
			return [name, peerId]
		})
	).then((entries) => Object.fromEntries(entries))

	const log = logger("canvas:gossiplog:test")

	const peers: Record<string, Libp2p<{ pubsub: GossipSub }>> = await Promise.all(
		Object.entries(init).map(async ([name, { port, peers }]) => {
			const peerId = peerIds[name]
			const address = getAddress(port)
			const bootstrapList = peers.map((peerName) => `${getAddress(init[peerName].port)}/p2p/${peerIds[peerName]}`)

			const libp2p = await createLibp2p({
				peerId: peerId,
				start: false,
				addresses: { listen: [address] },
				transports: [tcp()],
				connectionEncryption: [plaintext()],
				streamMuxers: [mplex()],
				peerDiscovery: bootstrapList.length > 0 ? [bootstrap({ list: bootstrapList, timeout: 0 })] : [],

				connectionManager: {
					minConnections: options.minConnections ?? peers.length,
					maxConnections: options.maxConnections ?? peers.length + 1,
					autoDialInterval: 1000,
				},

				services: {
					pubsub: gossipsub({
						emitSelf: false,
						fallbackToFloodsub: false,
						allowPublishToZeroPeers: true,
						globalSignaturePolicy: "StrictSign",
					}),

					identify: identifyService({ protocolPrefix: "canvas" }),
				},
			})

			libp2p.addEventListener("start", () => log("[%p] started", peerId))

			libp2p.addEventListener("transport:listening", ({ detail: listener }) => {
				const addrs = listener.getAddrs().map((addr) => addr.toString())
				log("[%p] listening on", peerId, addrs)
			})

			libp2p.addEventListener("peer:discovery", ({ detail: peerInfo }) =>
				log("[%p] discovered peer %p", peerId, peerInfo.id)
			)

			return [name, libp2p]
		})
	).then((entries) => Object.fromEntries(entries))

	if (options.start ?? true) {
		await Promise.all(Object.values(peers).map((peer) => peer.start()))
		t.teardown(() => Promise.all(Object.values(peers).map((peer) => peer.stop())))
	}

	return peers
}
