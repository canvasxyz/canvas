import type { ExecutionContext } from "ava"

import pDefer, { DeferredPromise } from "p-defer"

import { createLibp2p } from "libp2p"
import { identifyService } from "libp2p/identify"
import { plaintext } from "libp2p/insecure"

import { tcp } from "@libp2p/tcp"

import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"

import type { PeerId } from "@libp2p/interface-peer-id"
import { createEd25519PeerId } from "@libp2p/peer-id-factory"
import { logger } from "@libp2p/logger"

import { GossipLog, GossipLogEvents, GossipLogInit } from "@canvas-js/gossiplog"
import { Signature } from "@canvas-js/signed-cid"
import { IPLDValue, Message } from "@canvas-js/interfaces"
import { EventHandler } from "@libp2p/interfaces/events"

export type NetworkInit = Record<string, { port: number; peers: string[]; init: GossipLogInit }>

const getAddress = (port: number) => `/ip4/127.0.0.1/tcp/${port}`

export async function createNetwork(
	t: ExecutionContext<unknown>,
	networkInit: NetworkInit,
	options: { minConnections?: number; maxConnections?: number } = {}
): Promise<Record<string, GossipLog>> {
	const names = Object.keys(networkInit)

	const peerIds = await Promise.all(
		names.map<Promise<[string, PeerId]>>(async (name) => {
			const peerId = await createEd25519PeerId()
			return [name, peerId]
		})
	).then((entries) => Object.fromEntries(entries))

	const log = logger("canvas:gossiplog:test")

	const network: Record<string, GossipLog> = await Promise.all(
		Object.entries(networkInit).map(async ([name, { port, peers, init }]) => {
			const peerId = peerIds[name]
			const address = getAddress(port)
			const bootstrapList = peers.map(
				(peerName) => `${getAddress(networkInit[peerName].port)}/p2p/${peerIds[peerName]}`
			)

			const minConnections = options.minConnections ?? peers.length
			const maxConnections = options.maxConnections ?? peers.length + 1

			const libp2p = await createLibp2p({
				peerId: peerId,
				start: false,
				addresses: { listen: [address] },
				transports: [tcp()],
				connectionEncryption: [plaintext()],
				streamMuxers: [mplex()],
				peerDiscovery: bootstrapList.length > 0 ? [bootstrap({ list: bootstrapList, timeout: 0 })] : [],
				connectionManager: { minConnections, maxConnections, autoDialInterval: 1000 },

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

			const gossipLog = await GossipLog.init(libp2p, { minConnections, maxConnections, ...init })

			return [name, gossipLog] satisfies [string, GossipLog]
		})
	).then((entries) => Object.fromEntries(entries))

	t.teardown(() =>
		Promise.all(
			Object.values(network).map(async (gossipLog) => {
				await gossipLog.stop()
				await gossipLog.libp2p?.stop()
			})
		)
	)

	return network
}

/**
 * waits for every peer to open `minConnections` distinct connections
 */
export async function waitForInitialConnections(network: Record<string, GossipLog>): Promise<void> {
	const connectionCounts: Record<string, Set<string>> = {}
	const connectionPromises: Record<string, DeferredPromise<void>> = {}

	for (const source of Object.values(network)) {
		const sourceId = source.libp2p!.peerId.toString()
		connectionCounts[sourceId.toString()] = new Set()
		connectionPromises[sourceId] = pDefer()
		source.libp2p?.addEventListener("peer:connect", (event) => {
			const targetId = event.detail.toString()
			connectionCounts[sourceId].add(targetId)
			if (connectionCounts[sourceId].size >= source.minConnections) {
				connectionPromises[sourceId].resolve()
			}
		})
	}

	await Promise.all(Object.values(connectionPromises).map((defer) => defer.promise))
}

/**
 * waits for every peer to emit a `sync` event for every other peer
 */
export async function waitForInitialSync(network: Record<string, GossipLog>): Promise<void> {
	const syncPromises: Record<string, DeferredPromise<void>> = {}

	for (const source of Object.values(network)) {
		const sourceId = source.libp2p!.peerId
		for (const target of Object.values(network)) {
			const targetId = target.libp2p!.peerId
			if (sourceId.equals(targetId)) {
				continue
			}

			const defer = pDefer<void>()
			syncPromises[`${sourceId}:${targetId}`] = defer
		}

		source.addEventListener(
			"sync",
			({ detail: { peerId: targetId } }) => syncPromises[`${sourceId}:${targetId}`].resolve(),
			{ once: true }
		)
	}

	await Promise.all(Object.values(syncPromises).map((defer) => defer.promise))
}

export async function waitForMessageDelivery(
	t: ExecutionContext<unknown>,
	network: Record<string, GossipLog>,
	match: (id: string, signature: Signature | null, message: Message<IPLDValue>) => boolean
): Promise<void> {
	const ids = await Promise.all(
		Object.entries(network).map(([name, gossipLog]) => {
			const peerId = gossipLog.libp2p!.peerId.toString()
			const deferred = pDefer<string>()
			const handler: EventHandler<GossipLogEvents["message"]> = ({ detail: { id, signature, message } }) => {
				if (match(id, signature, message)) {
					t.log(`delivered ${id} to peer ${name} (${peerId})`)
					deferred.resolve(id)
				}
			}

			gossipLog.addEventListener("message", handler)
			return deferred.promise.finally(() => gossipLog.removeEventListener("message", handler))
		})
	)

	t.true(
		ids.every((id) => id === ids[0]),
		"expected all ids to be equal"
	)

	t.log(`delivered ${ids[0]} to all peers`)
}
