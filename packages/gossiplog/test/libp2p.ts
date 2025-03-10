import type { ExecutionContext } from "ava"

import pDefer, { DeferredPromise } from "p-defer"

import type { Libp2p, PrivateKey } from "@libp2p/interface"
import { logger } from "@libp2p/logger"
import { generateKeyPair } from "@libp2p/crypto/keys"
import { peerIdFromPrivateKey } from "@libp2p/peer-id"

import { Awaitable, Message, Signature } from "@canvas-js/interfaces"
import { AbstractGossipLog, SignedMessage } from "@canvas-js/gossiplog"
import { getLibp2p, ServiceMap } from "@canvas-js/gossiplog/libp2p"

import { mapValues } from "@canvas-js/utils"

export type NetworkNodeInit = Record<string, { port: number; peers?: string[] }>

export type NetworkNode<Payload> = {
	messageLog: AbstractGossipLog<Payload>
	libp2p: Libp2p<ServiceMap<Payload>>
}

const getAddress = (port: number) => `/ip4/127.0.0.1/tcp/${port}/ws`

export async function createNetwork<T extends NetworkNodeInit, Payload>(
	t: ExecutionContext<unknown>,
	openMessageLog: () => Awaitable<AbstractGossipLog<Payload>>,
	networkInit: T,
): Promise<{ [K in keyof T]: NetworkNode<Payload> }> {
	const names = Object.keys(networkInit)

	const privateKeys = await Promise.all(
		names.map<Promise<[string, PrivateKey]>>((name) =>
			generateKeyPair("Ed25519").then((privateKey) => [name, privateKey]),
		),
	).then((entries) => Object.fromEntries(entries))

	const peerIds = mapValues(privateKeys, peerIdFromPrivateKey)

	const log = logger("canvas:gossiplog:test")

	const network: Record<string, NetworkNode<Payload>> = await Promise.all(
		Object.entries(networkInit).map(async ([name, { port, peers }]) => {
			const messageLog = await openMessageLog()

			const address = getAddress(port)
			const bootstrapList =
				peers?.map((peerName) => `${getAddress(networkInit[peerName].port)}/p2p/${peerIds[peerName]}`) ?? []

			const libp2p = await getLibp2p(messageLog, {
				start: false,
				privateKey: privateKeys[name],
				listen: [address],
				announce: [address],
				bootstrapList,
				// rendezvousPoints: [],
			})

			libp2p.addEventListener("start", () => log("[%p] started", peerIds[name]))

			libp2p.addEventListener("transport:listening", ({ detail: listener }) => {
				const addrs = listener.getAddrs().map((addr) => addr.toString())
				log("[%p] listening on", peerIds[name], addrs)
			})

			libp2p.addEventListener("peer:discovery", ({ detail: peerInfo }) => {
				log("[%p] discovered peer %p", peerIds[name], peerInfo.id)
			})

			return [name, { messageLog, libp2p }]
		}),
	).then((entries) => Object.fromEntries(entries))

	t.teardown(async () => {
		await Promise.all(
			Object.values(network).map(async ({ messageLog, libp2p }) => {
				await libp2p.stop()
				await messageLog.close()
			}),
		)
	})

	await Promise.all(Object.values(network).map(({ libp2p }) => libp2p.start()))

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

	for (const { libp2p } of Object.values(network)) {
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
	network: Record<string, NetworkNode<Payload>>,
	links: [string, string][],
): Promise<void> {
	const wait = (source: string, target: string) =>
		new Promise<void>((resolve) => {
			network[source].libp2p.services.pubsub.addEventListener(
				"gossipsub:graft",
				({ detail: { peerId } }) => {
					if (peerId === network[target].libp2p.peerId.toString()) {
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
	network: Record<string, { messageLog: AbstractGossipLog<Payload>; libp2p: Libp2p<ServiceMap<Payload>> }>,
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

export async function waitForMessageDelivery<Payload>(
	t: ExecutionContext<unknown>,
	network: Record<string, NetworkNode<Payload>>,
	match: (signedMessage: SignedMessage) => boolean,
): Promise<SignedMessage> {
	const results = await Promise.all(
		Object.entries(network).map(([name, { messageLog, libp2p }]) => {
			const peerId = libp2p.peerId.toString()
			const deferred = pDefer<SignedMessage>()
			const handler = ({ detail: signedMessage }: CustomEvent<SignedMessage>) => {
				if (match(signedMessage)) {
					t.log(`delivered ${signedMessage.id} to peer ${name} (${peerId})`)
					deferred.resolve(signedMessage)
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
