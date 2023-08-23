import type { ExecutionContext } from "ava"

import { Libp2p, createLibp2p } from "libp2p"
import { identifyService } from "libp2p/identify"
import { plaintext } from "libp2p/insecure"

import { tcp } from "@libp2p/tcp"

import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub, GossipsubEvents } from "@chainsafe/libp2p-gossipsub"

import type { PubSub } from "@libp2p/interface-pubsub"
import type { PeerId } from "@libp2p/interface-peer-id"
import { createEd25519PeerId } from "@libp2p/peer-id-factory"

import { IPLDValue } from "@canvas-js/interfaces"
import { GossipLog, GossipLogInit, gossiplog } from "@canvas-js/libp2p-gossiplog"

import { mapValues } from "./utils.js"

export type NetworkInit = Record<
	string,
	{ port: number; peers: string[]; logs: Record<string, GossipLogInit<IPLDValue>> }
>

const getAddress = (port: number) => `/ip4/127.0.0.1/tcp/${port}`

export async function createNetwork<T extends Record<string, GossipLog<IPLDValue>> = {}>(
	t: ExecutionContext<unknown>,
	init: NetworkInit,
	options: { start?: boolean; minConnections?: number; maxConnections?: number } = {}
): Promise<Record<string, Libp2p<{ pubsub: PubSub<GossipsubEvents> } & T>>> {
	const names = Object.keys(init)

	const peerIds = await Promise.all(
		names.map<Promise<[string, PeerId]>>(async (name) => {
			const peerId = await createEd25519PeerId()
			return [name, peerId]
		})
	).then((entries) => Object.fromEntries(entries))

	const peers: Record<string, Libp2p<{ pubsub: PubSub<GossipsubEvents> } & T>> = await Promise.all(
		Object.entries(init).map(async ([name, { port, peers, logs }]) => {
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

					...mapValues(logs, gossiplog),
				},
			})

			libp2p.addEventListener("start", () => console.log("[%s] started", peerId))

			libp2p.addEventListener("transport:listening", ({ detail: listener }) => {
				const addrs = listener.getAddrs().map((addr) => addr.toString())
				console.log("[%s] listening on", peerId, addrs)
			})

			libp2p.addEventListener("connection:open", ({ detail: connection }) =>
				console.log("[%s] opened connection %s with %s", peerId, connection.id, connection.remotePeer)
			)

			libp2p.addEventListener("connection:close", ({ detail: connection }) =>
				console.log("[%s] closed connection %s with %s", peerId, connection.id, connection.remotePeer)
			)

			libp2p.addEventListener("peer:discovery", ({ detail: peerInfo }) =>
				console.log("[%s] discovered peer %s", peerId, peerInfo.id)
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
