import type { ExecutionContext } from "ava"

import pDefer, { DeferredPromise } from "p-defer"

import type { PeerId, PubSub, EventHandler } from "@libp2p/interface"

import { Libp2p, createLibp2p } from "libp2p"
import { identify as identifyService } from "@libp2p/identify"
import { plaintext } from "@libp2p/plaintext"
import { tcp } from "@libp2p/tcp"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { GossipsubEvents, gossipsub } from "@chainsafe/libp2p-gossipsub"

import { createEd25519PeerId } from "@libp2p/peer-id-factory"
import { logger } from "@libp2p/logger"

import { Message, Signature } from "@canvas-js/interfaces"
import { AbstractGossipLog, GossipLogInit, GossipLogEvents } from "@canvas-js/gossiplog"
import { GossipLogService, GossipLogServiceInit, gossiplog } from "@canvas-js/gossiplog/service"

export type NetworkConfig = Record<string, { port: number; peers: string[] }>

const getAddress = (port: number) => `/ip4/127.0.0.1/tcp/${port}`

export type ServiceMap<Payload> = {
	identify: {}
	pubsub: PubSub<GossipsubEvents>
	gossiplog: GossipLogService<Payload>
}

export async function createNetwork<T extends NetworkConfig, Payload>(
	t: ExecutionContext<unknown>,
	openMessageLog: () => Promise<AbstractGossipLog<Payload>>,
	networkConfig: T,
	serviceInit: GossipLogServiceInit = {},
	options: { start?: boolean; minConnections?: number; maxConnections?: number } = {},
): Promise<{ [K in keyof T]: Libp2p<ServiceMap<Payload>> }> {
	const names = Object.keys(networkConfig)

	const peerIds = await Promise.all(
		names.map<Promise<[string, PeerId]>>(async (name) => {
			const peerId = await createEd25519PeerId()
			return [name, peerId]
		}),
	).then((entries) => Object.fromEntries(entries))

	const log = logger("canvas:gossiplog:test")

	const network: Record<string, Libp2p<ServiceMap<Payload>>> = await Promise.all(
		Object.entries(networkConfig).map(async ([name, { port, peers }]) => {
			const messageLog = await openMessageLog()
			const peerId = peerIds[name]
			const address = getAddress(port)
			const bootstrapList = peers.map(
				(peerName) => `${getAddress(networkConfig[peerName].port)}/p2p/${peerIds[peerName]}`,
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
						allowPublishToZeroTopicPeers: true,
						globalSignaturePolicy: "StrictSign",

						asyncValidation: true,
					}),

					gossiplog: gossiplog(messageLog, serviceInit),
				},
			})

			libp2p.addEventListener("start", () => log("[%p] started", peerId))

			libp2p.addEventListener("transport:listening", ({ detail: listener }) => {
				const addrs = listener.getAddrs().map((addr) => addr.toString())
				log("[%p] listening on", peerId, addrs)
			})

			libp2p.addEventListener("peer:discovery", ({ detail: peerInfo }) =>
				log("[%p] discovered peer %p", peerId, peerInfo.id),
			)

			libp2p.addEventListener("peer:connect", ({ detail }) => {
				log("[%p] connected to peer %p", peerId, detail)
			})

			return [name, libp2p]
		}),
	).then((entries) => Object.fromEntries(entries))

	if (options.start ?? true) {
		t.teardown(() => Promise.all(Object.values(network).map((libp2p) => libp2p.stop())))
		await Promise.all(Object.values(network).map((libp2p) => libp2p.start()))
	}

	return network as { [K in keyof T]: Libp2p<ServiceMap<Payload>> }
}

/**
 * waits for every peer to open `minConnections` distinct connections
 */
export async function waitForInitialConnections<Payload>(
	network: Record<string, Libp2p<ServiceMap<Payload>>>,
	options: { minConnections?: number } = {},
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
export async function waitForInitialSync<Payload>(network: Record<string, Libp2p<ServiceMap<Payload>>>): Promise<void> {
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
			({ detail: { peer: targetId } }) => syncPromises[`${sourceId}:${targetId}`].resolve(),
			{ once: true },
		)
	}

	await Promise.all(Object.values(syncPromises).map((defer) => defer.promise))
}

type Result = { id: string; signature: Signature; message: Message }

export async function waitForMessageDelivery<Payload>(
	t: ExecutionContext<unknown>,
	network: Record<string, Libp2p<ServiceMap<Payload>>>,
	match: (id: string, signature: Signature, message: Message) => boolean,
): Promise<Result> {
	const results = await Promise.all(
		Object.entries(network).map(([name, libp2p]) => {
			const peerId = libp2p.peerId.toString()
			const deferred = pDefer<Result>()
			const handler: EventHandler<GossipLogEvents<unknown>["message"]> = ({ detail: { id, signature, message } }) => {
				if (match(id, signature, message)) {
					t.log(`delivered ${id} to peer ${name} (${peerId})`)
					deferred.resolve({ id, signature, message })
				}
			}

			libp2p.services.gossiplog.addEventListener("message", handler)
			return deferred.promise.finally(() => libp2p.services.gossiplog.removeEventListener("message", handler))
		}),
	)

	const [result] = results

	t.true(
		results.every(({ id }) => id === result.id),
		"expected all ids to be equal",
	)

	t.log(`delivered ${result.id} to all peers`)

	return result
}
