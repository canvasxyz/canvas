import type { ExecutionContext } from "ava"

import pDefer, { DeferredPromise } from "p-defer"

import type { PeerId, EventHandler } from "@libp2p/interface"

import { Libp2p, createLibp2p } from "libp2p"
import { identify as identifyService } from "@libp2p/identify"
import { noise } from "@chainsafe/libp2p-noise"
import { yamux } from "@chainsafe/libp2p-yamux"
import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"

import { createEd25519PeerId } from "@libp2p/peer-id-factory"
import { logger } from "@libp2p/logger"

import { Awaitable, Message, Signature } from "@canvas-js/interfaces"
import { ServiceMap, AbstractGossipLog, GossipLogEvents } from "@canvas-js/gossiplog"
import { GossipLogServiceInit, gossiplog } from "@canvas-js/gossiplog/service"

export type NetworkInit = Record<string, { port: number; peers?: string[] }>

const getAddress = (port: number) => `/ip4/127.0.0.1/tcp/${port}/ws`

export async function createNetwork<T extends NetworkInit, Payload>(
	t: ExecutionContext<unknown>,
	openMessageLog: () => Awaitable<AbstractGossipLog<Payload>>,
	networkInit: T,
	serviceInit: GossipLogServiceInit = {},
	options: { start?: boolean; minConnections?: number; maxConnections?: number } = {},
): Promise<{ [K in keyof T]: Libp2p<ServiceMap<Payload>> }> {
	const names = Object.keys(networkInit)

	const peerIds = await Promise.all(
		names.map<Promise<[string, PeerId]>>((name) => createEd25519PeerId().then((peerId) => [name, peerId])),
	).then((entries) => Object.fromEntries(entries))

	const log = logger("canvas:gossiplog:test")

	const network: Record<string, Libp2p<ServiceMap<Payload>>> = await Promise.all(
		Object.entries(networkInit).map(async ([name, { port, peers }]) => {
			const messageLog = await openMessageLog()
			const peerId = peerIds[name]
			const address = getAddress(port)
			const bootstrapList =
				peers?.map((peerName) => `${getAddress(networkInit[peerName].port)}/p2p/${peerIds[peerName]}`) ?? []

			const minConnections = peers?.length ?? 0

			const libp2p = await createLibp2p({
				peerId: peerId,
				start: false,
				addresses: { listen: [address] },
				transports: [webSockets({ filter: all })],
				connectionEncryption: [noise()],
				streamMuxers: [yamux()],
				peerDiscovery: bootstrapList.length > 0 ? [bootstrap({ list: bootstrapList, timeout: 0 })] : [],
				connectionManager: { minConnections, autoDialInterval: 200 },

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

			libp2p.addEventListener("peer:discovery", ({ detail: peerInfo }) => {
				log("[%p] discovered peer %p", peerId, peerInfo.id)
			})

			libp2p.addEventListener("connection:open", ({ detail: { id, remotePeer } }) => {
				log("[%p] opened connection %s to peer %p", peerId, id, remotePeer)
			})

			libp2p.addEventListener("connection:close", ({ detail: { id, remotePeer } }) => {
				log("[%p] closed connection %s to peer %p", peerId, id, remotePeer)
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

export async function waitForGraft<Payload>(
	network: Record<string, Libp2p<ServiceMap<Payload>>>,
	links: [string, string][],
): Promise<void> {
	const wait = (source: string, target: string) =>
		new Promise<void>((resolve) => {
			network[source].services.pubsub.addEventListener(
				"gossipsub:graft",
				({ detail: { peerId } }) => {
					if (peerId === network[target].peerId.toString()) {
						resolve()
					}
				},
				{ once: true },
			)
		})

	await Promise.all(links.map(([source, target]) => [wait(source, target), wait(target, source)]).flat())
}

/**
 * waits for every peer to emit a `sync` event for every other peer
 */
export async function waitForInitialSync<Payload>(
	network: Record<string, Libp2p<ServiceMap<Payload>>>,
	links: [string, string][],
): Promise<void> {
	const wait = (source: string, target: string) =>
		new Promise<void>((resolve) => {
			network[source].services.gossiplog.addEventListener(
				"sync",
				({ detail: { peerId } }) => {
					if (peerId === network[target].peerId.toString()) {
						resolve()
					}
				},
				{ once: true },
			)
		})

	await Promise.all(links.map(([source, target]) => [wait(source, target), wait(target, source)]).flat())
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
