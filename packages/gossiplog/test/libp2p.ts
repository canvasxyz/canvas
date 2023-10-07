import type { ExecutionContext } from "ava"

import pDefer, { DeferredPromise } from "p-defer"

import type { PeerId } from "@libp2p/interface/peer-id"
import type { EventHandler } from "@libp2p/interface/events"
import type { PubSub } from "@libp2p/interface/pubsub"

import { Libp2p, createLibp2p } from "libp2p"
import { identifyService } from "libp2p/identify"
import { plaintext } from "libp2p/insecure"
import { tcp } from "@libp2p/tcp"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"

import { createEd25519PeerId } from "@libp2p/peer-id-factory"
import { logger } from "@libp2p/logger"

import { Signature } from "@canvas-js/signed-cid"
import { Message } from "@canvas-js/interfaces"
import { GossipLogService, GossipLogEvents, GossipLogServiceInit, gossiplog } from "@canvas-js/gossiplog"

export type NetworkInit = Record<string, { port: number; peers: string[]; init?: GossipLogServiceInit }>

const getAddress = (port: number) => `/ip4/127.0.0.1/tcp/${port}`

export type ServiceMap = {
	identify: {}
	pubsub: PubSub
	gossiplog: GossipLogService
}

export async function createNetwork(
	t: ExecutionContext<unknown>,
	networkInit: NetworkInit,
	options: { start?: boolean; minConnections?: number; maxConnections?: number } = {}
): Promise<Record<string, Libp2p<ServiceMap>>> {
	const names = Object.keys(networkInit)

	const peerIds = await Promise.all(
		names.map<Promise<[string, PeerId]>>(async (name) => {
			const peerId = await createEd25519PeerId()
			return [name, peerId]
		})
	).then((entries) => Object.fromEntries(entries))

	const log = logger("canvas:gossiplog:test")

	const network: Record<string, Libp2p<ServiceMap>> = await Promise.all(
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
					identify: identifyService({ protocolPrefix: "canvas" }),

					pubsub: gossipsub({
						emitSelf: false,
						fallbackToFloodsub: false,
						allowPublishToZeroPeers: true,
						globalSignaturePolicy: "StrictSign",
					}),

					gossiplog: gossiplog(init ?? {}),
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

			libp2p.addEventListener("peer:connect", ({ detail }) => {
				log("[%p] connected to peer %p", peerId, detail)
			})

			return [name, libp2p]
		})
	).then((entries) => Object.fromEntries(entries))

	if (options.start ?? true) {
		t.teardown(() => Promise.all(Object.values(network).map((libp2p) => libp2p.stop())))
		await Promise.all(Object.values(network).map((libp2p) => libp2p.start()))
	}

	return network
}

/**
 * waits for every peer to open `minConnections` distinct connections
 */
export async function waitForInitialConnections(
	network: Record<string, Libp2p<ServiceMap>>,
	options: { minConnections?: number } = {}
): Promise<void> {
	const minConnections = options.minConnections ?? Object.keys(network).length - 1

	const connectionCounts: Record<string, Set<string>> = {}
	const connectionPromises: Record<string, DeferredPromise<void>> = {}

	for (const libp2p of Object.values(network)) {
		const sourceId = libp2p.peerId.toString()
		connectionCounts[sourceId.toString()] = new Set()
		connectionPromises[sourceId] = pDefer()
		libp2p.addEventListener("peer:connect", (event) => {
			const targetId = event.detail.toString()
			connectionCounts[sourceId].add(targetId)
			if (connectionCounts[sourceId].size >= minConnections) {
				connectionPromises[sourceId].resolve()
			}
		})
	}

	await Promise.all(Object.values(connectionPromises).map((defer) => defer.promise))
}

/**
 * waits for every peer to emit a `sync` event for every other peer
 */
export async function waitForInitialSync(network: Record<string, Libp2p<ServiceMap>>): Promise<void> {
	const syncPromises: Record<string, DeferredPromise<void>> = {}

	for (const source of Object.values(network)) {
		const sourceId = source.peerId
		for (const target of Object.values(network)) {
			const targetId = target.peerId
			if (sourceId.equals(targetId)) {
				continue
			}

			const defer = pDefer<void>()
			syncPromises[`${sourceId}:${targetId}`] = defer
		}

		source.services.gossiplog.addEventListener(
			"sync",
			({ detail: { peerId: targetId } }) => syncPromises[`${sourceId}:${targetId}`].resolve(),
			{ once: true }
		)
	}

	await Promise.all(Object.values(syncPromises).map((defer) => defer.promise))
}

type Result = { id: string; signature: Signature | null; message: Message }

export async function waitForMessageDelivery(
	t: ExecutionContext<unknown>,
	network: Record<string, Libp2p<ServiceMap>>,
	match: (id: string, signature: Signature | null, message: Message) => boolean
): Promise<Result> {
	const results = await Promise.all(
		Object.entries(network).map(([name, libp2p]) => {
			const peerId = libp2p.peerId.toString()
			const deferred = pDefer<Result>()
			const handler: EventHandler<GossipLogEvents["message"]> = ({ detail: { id, signature, message } }) => {
				if (match(id, signature, message)) {
					t.log(`delivered ${id} to peer ${name} (${peerId})`)
					deferred.resolve({ id, signature, message })
				}
			}

			libp2p.services.gossiplog.addEventListener("message", handler)
			return deferred.promise.finally(() => libp2p.services.gossiplog.removeEventListener("message", handler))
		})
	)

	t.true(
		results.every(({ id }) => id === results[0].id),
		"expected all ids to be equal"
	)

	t.log(`delivered ${results[0].id} to all peers`)

	return results[0]
}
