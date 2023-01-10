import { createHash } from "node:crypto"

import type { Libp2p, Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"
import type { RoutingTable } from "@libp2p/kad-dht/dist/src/routing-table/index.js"

import { webSockets } from "@libp2p/websockets"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { kadDHT } from "@libp2p/kad-dht"
import { prometheusMetrics } from "@libp2p/prometheus-metrics"

import { isLoopback } from "@libp2p/utils/multiaddr/is-loopback"
import { isPrivate } from "@libp2p/utils/multiaddr/is-private"
import { Multiaddr } from "@multiformats/multiaddr"
import { TimeoutController } from "timeout-abort-controller"

import { AbortError, toHex, wait } from "./utils.js"
import { libp2pRegister } from "./metrics.js"
import * as constants from "./constants.js"

const bootstrapList = [
	"/dns4/canvas-bootstrap-p0.fly.dev/tcp/4002/ws/p2p/12D3KooWP4DLJuVUKoThfzYugv8c326MuM2Tx38ybvEyDjLQkE2o",
	"/dns4/canvas-bootstrap-p1.fly.dev/tcp/4002/ws/p2p/12D3KooWRftkCBMtYou4pM3VKdqkKVDAsWXnc8NabUNzx7gp7cPT",
	"/dns4/canvas-bootstrap-p2.fly.dev/tcp/4002/ws/p2p/12D3KooWPopNdRnzswSd8oVxrUBKGhgKzkYALETK7EHkToy7DKk3",
]

const announceFilter = (multiaddrs: Multiaddr[]) =>
	multiaddrs.filter((multiaddr) => !isLoopback(multiaddr) && !isPrivate(multiaddr))

const denyDialMultiaddr = async (peerId: PeerId, multiaddr: Multiaddr) => isLoopback(multiaddr)

const second = 1000
const minute = 60 * second

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
		dht: kadDHT({
			protocolPrefix: "/canvas",
			clientMode: false,
			providers: { provideValidity: 20 * minute, cleanupInterval: 5 * minute },
		}),
		metrics: prometheusMetrics({ registry: libp2pRegister }),
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
		}),
	}
}

// Augment RoutingTable.kb.toIterable() signature
declare module "@libp2p/kad-dht/dist/src/routing-table/index.js" {
	interface KBucket {
		peer: PeerId
	}
}

export async function startPingService(
	libp2p: Libp2p,
	controller: AbortController,
	{ verbose }: { verbose?: boolean } = {}
) {
	async function ping(routingTable: RoutingTable, peer: PeerId) {
		// These are declared as private in RoutingTable :/
		// @ts-expect-error
		const pingTimeout: number = routingTable.pingTimeout
		// @ts-expect-error
		const protocol: string = routingTable.protocol

		const timeoutController = new TimeoutController(pingTimeout)
		const abort = () => timeoutController.abort()
		controller.signal.addEventListener("abort", abort)

		try {
			const connection = await libp2p.connectionManager.openConnection(peer, { signal: timeoutController.signal })
			const stream = await connection.newStream(protocol, { signal: timeoutController.signal })
			stream.close()
		} finally {
			controller.signal.removeEventListener("abort", abort)
		}
	}

	async function pingTable(routingTable: RoutingTable): Promise<[successCount: number, failureCount: number]> {
		let successCount = 0
		let failureCount = 0
		let peerIndex = 0

		for (const { peer } of routingTable.kb?.toIterable() ?? []) {
			if (verbose) {
				console.log(`[canvas-core] Ping ${peer.toString()} (${++peerIndex}/${routingTable.size})`)
			}

			if (peer.equals(libp2p.peerId)) {
				if (verbose) {
					console.log(`[canvas-core] Ping ${peer.toString()} skipped (is self)`)
				}
				successCount += 1
				continue
			}

			try {
				await ping(routingTable, peer)
				if (verbose) {
					console.log(`[canvas-core] Ping ${peer.toString()} succeeded`)
				}

				successCount += 1
			} catch (err) {
				if (verbose) {
					console.log(`[canvas-core] Ping ${peer.toString()} failed`)
					console.error(err)
				}

				failureCount += 1
				await routingTable.remove(peer)
			}
		}

		return [successCount, failureCount]
	}

	const wanRoutingTable = libp2p.dht.wan.routingTable as RoutingTable
	const lanRoutingTable = libp2p.dht.lan.routingTable as RoutingTable

	wanRoutingTable.kb?.on("added", ({ peer }) => {
		wanRoutingTable.pingQueue.add(async () => {
			if (peer.equals(libp2p.peerId)) {
				return
			}

			if (verbose) {
				console.log(`[canvas-core] Ping ${peer.toString()}`)
			}

			try {
				await ping(wanRoutingTable, peer)
				if (verbose) {
					console.log(`[canvas-core] Ping ${peer.toString()} succeeded`)
				}
			} catch (err) {
				if (verbose) {
					console.log(`[canvas-core] Ping ${peer.toString()} failed`)
				}
				await wanRoutingTable.remove(peer)
			}
		})
	})

	lanRoutingTable.kb?.on("added", ({ peer }) => {
		lanRoutingTable.pingQueue.add(async () => {
			if (peer.equals(libp2p.peerId)) {
				return
			}

			if (verbose) {
				console.log(`[canvas-core] Ping ${peer.toString()}`)
			}

			try {
				await ping(lanRoutingTable, peer)
				if (verbose) {
					console.log(`[canvas-core] Ping ${peer.toString()} succeeded`)
				}
			} catch (err) {
				if (verbose) {
					console.log(`[canvas-core] Ping ${peer.toString()} failed`)
				}
				await lanRoutingTable.remove(peer)
			}
		})
	})

	try {
		console.log("[canvas-core] Starting ping service")

		while (!controller.signal.aborted) {
			await wait({ signal: controller.signal, interval: constants.DHT_PING_INTERVAL })

			await lanRoutingTable.pingQueue.add(async () => {
				console.log(`[canvas-core] Starting LAN routing table ping (${lanRoutingTable.size} entries)`)
				const [successCount, failureCount] = await pingTable(lanRoutingTable)
				console.log(
					`[canvas-core] Finished LAN routing table ping (${successCount} responses, ${failureCount} evicted)`
				)
			})

			await wanRoutingTable.pingQueue.add(async () => {
				console.log(`[canvas-core] Starting WAN routing table ping (${wanRoutingTable.size} entries)`)
				const [successCount, failureCount] = await pingTable(wanRoutingTable)
				console.log(
					`[canvas-core] Finished WAN routing table ping (${successCount} responses, ${failureCount} evicted)`
				)
			})
		}
	} catch (err) {
		if (err instanceof AbortError) {
			console.log("[canvas-core] Aborting ping service")
		} else {
			console.error("[canvas-core] Ping service crashed", err)
		}
	}
}
