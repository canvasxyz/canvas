import type { ExecutionContext } from "ava"

import pDefer, { DeferredPromise } from "p-defer"

import type { PeerId, EventHandler, Libp2p } from "@libp2p/interface"

import { createEd25519PeerId } from "@libp2p/peer-id-factory"
import { logger } from "@libp2p/logger"

import { Awaitable, Message, Signature } from "@canvas-js/interfaces"
import { ServiceMap, AbstractGossipLog, GossipLogEvents, SignedMessage } from "@canvas-js/gossiplog"
import { NetworkPeer } from "@canvas-js/gossiplog/network/peer"

export type NetworkNodeInit = Record<string, { port: number; peers?: string[] }>

export type NetworkNode<Payload> = {
	messageLog: AbstractGossipLog<Payload>
	peer: NetworkPeer<Payload>
}

const getAddress = (port: number) => `/ip4/127.0.0.1/tcp/${port}/ws`

export async function createNetwork<T extends NetworkNodeInit, Payload>(
	t: ExecutionContext<unknown>,
	openMessageLog: () => Awaitable<AbstractGossipLog<Payload>>,
	networkInit: T,
): Promise<{ [K in keyof T]: NetworkNode<Payload> }> {
	const names = Object.keys(networkInit)

	const peerIds = await Promise.all(
		names.map<Promise<[string, PeerId]>>((name) => createEd25519PeerId().then((peerId) => [name, peerId])),
	).then((entries) => Object.fromEntries(entries))

	const log = logger("canvas:gossiplog:test")

	const network: Record<string, NetworkNode<Payload>> = await Promise.all(
		Object.entries(networkInit).map(async ([name, { port, peers }]) => {
			const messageLog = await openMessageLog()

			const peerId = peerIds[name]
			const address = getAddress(port)
			const bootstrapList =
				peers?.map((peerName) => `${getAddress(networkInit[peerName].port)}/p2p/${peerIds[peerName]}`) ?? []

			const minConnections = peers?.length ?? 0

			const peer = await NetworkPeer.create(messageLog, {
				peerId,
				start: false,
				listen: [address],
				announce: [],
				bootstrapList,
				minConnections,
			})

			peer.libp2p.addEventListener("start", () => log("[%p] started", peerId))

			peer.libp2p.addEventListener("transport:listening", ({ detail: listener }) => {
				const addrs = listener.getAddrs().map((addr) => addr.toString())
				log("[%p] listening on", peerId, addrs)
			})

			peer.libp2p.addEventListener("peer:discovery", ({ detail: peerInfo }) => {
				log("[%p] discovered peer %p", peerId, peerInfo.id)
			})

			return [name, { messageLog, peer }]
		}),
	).then((entries) => Object.fromEntries(entries))

	t.teardown(async () => {
		await Promise.all(
			Object.values(network).map(async ({ messageLog, peer }) => {
				await peer.stop()
				await messageLog.close()
			}),
		)
	})

	await Promise.all(Object.values(network).map(({ peer }) => peer.start()))

	return network as { [K in keyof T]: NetworkNode<Payload> }
}

/**
 * waits for every peer to open `minConnections` distinct connections
 */
export async function waitForInitialConnections<Payload>(
	network: Record<string, NetworkNode<Payload>>,
	options: { minConnections?: number } = {},
): Promise<void> {
	const minConnections = options.minConnections ?? Object.keys(network).length - 1

	const connectionCounts: Record<string, Set<string>> = {}
	const connectionPromises: Record<string, DeferredPromise<void>> = {}

	for (const { peer } of Object.values(network)) {
		const sourceId = peer.libp2p.peerId.toString()
		connectionCounts[sourceId.toString()] = new Set()
		connectionPromises[sourceId] = pDefer()
		peer.libp2p.addEventListener("peer:connect", (event) => {
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
	network: Record<string, NetworkNode<Payload>>,
	links: [string, string][],
): Promise<void> {
	const wait = (source: string, target: string) =>
		new Promise<void>((resolve) => {
			network[source].peer.pubsub.addEventListener(
				"gossipsub:graft",
				({ detail: { peerId } }) => {
					if (peerId === network[target].peer.libp2p.peerId.toString()) {
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
	network: Record<string, { messageLog: AbstractGossipLog<Payload>; libp2p: Libp2p<ServiceMap> }>,
	links: [string, string][],
): Promise<void> {
	const wait = (source: string, target: string) =>
		new Promise<void>((resolve) => {
			network[source].messageLog.addEventListener(
				"sync",
				({ detail: { peer } }) => {
					if (peer === network[target].libp2p.peerId.toString()) {
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
	network: Record<string, NetworkNode<Payload>>,
	match: (id: string, signature: Signature, message: Message) => boolean,
): Promise<Result> {
	const results = await Promise.all(
		Object.entries(network).map(([name, { messageLog, peer }]) => {
			const peerId = peer.libp2p.peerId.toString()
			const deferred = pDefer<Result>()
			const handler = ({ detail: { id, signature, message } }: CustomEvent<SignedMessage>) => {
				if (match(id, signature, message)) {
					t.log(`delivered ${id} to peer ${name} (${peerId})`)
					deferred.resolve({ id, signature, message })
				}
			}

			messageLog.addEventListener("message", handler)
			return deferred.promise.finally(() => messageLog.removeEventListener("message", handler))
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
