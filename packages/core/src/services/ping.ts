import chalk from "chalk"

import type { Libp2p } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"
import type { kadDHT } from "@libp2p/kad-dht"

import { anySignal } from "any-signal"

type DualKadDHT = ReturnType<ReturnType<typeof kadDHT>>
type KadDHT = DualKadDHT["wan"]
type RoutingTable = KadDHT["routingTable"]

import { TimeoutController } from "timeout-abort-controller"

import { logErrorMessage, wait } from "@canvas-js/core/utils"
import { PING_INTERVAL, PING_TIMEOUT } from "@canvas-js/core/constants"
import PQueue from "p-queue"

function* forContacts(routingTable: RoutingTable): Iterable<PeerId> {
	if (routingTable.kb === undefined) {
		return
	}

	for (const contact of routingTable.kb.toIterable()) {
		yield contact.peer
	}
}

export async function startPingService(
	libp2p: Libp2p,
	{ verbose, ...options }: { signal?: AbortSignal; verbose?: boolean } = {}
) {
	const prefix = chalk.hex("#dabaf7")(`[canvas-core] [ping]`)

	const pingQueuePeerIds = new Set<string>()
	const pingQueue = new PQueue({ concurrency: 1 })

	options.signal?.addEventListener("abort", () => {
		pingQueue.pause()
		pingQueue.clear()
	})

	async function ping(peer: PeerId, protocol: string, routingTable: RoutingTable): Promise<boolean> {
		if (peer.equals(libp2p.peerId)) {
			return true
		}

		if (verbose) {
			const { addresses } = await libp2p.peerStore.get(peer)
			console.log(prefix, `Ping ${peer} [ ${addresses.map(({ multiaddr }) => multiaddr).join(", ")} ]`)
		}

		const timeoutController = new TimeoutController(PING_TIMEOUT)
		const signal = anySignal([timeoutController.signal, options.signal])

		try {
			const stream = await libp2p.dialProtocol(peer, protocol, { signal: timeoutController.signal })
			stream.close()

			if (verbose) {
				console.log(prefix, `Ping ${peer} succeeded`)
			}

			return true
		} catch (err) {
			if (verbose) {
				logErrorMessage(prefix, `Ping ${peer} failed`, err)
			}

			if (routingTable.isStarted()) {
				await libp2p.hangUp(peer)
				await routingTable.remove(peer)
			}

			return false
		} finally {
			timeoutController.clear()
			signal.clear()
		}
	}

	async function pingTable(
		protocol: string,
		routingTable: RoutingTable
	): Promise<[successCount: number, failureCount: number]> {
		const contacts = [...forContacts(routingTable)]

		let successCount = 0
		let failureCount = 0

		for (const peer of contacts) {
			const id = peer.toString()
			if (pingQueuePeerIds.has(id)) {
				continue
			} else {
				if (verbose) {
					console.log(prefix, `Adding ${peer} to ping queue #${pingQueue.size}`)
				}

				pingQueuePeerIds.add(id)

				const active = await pingQueue
					.add(() => ping(peer, protocol, routingTable))
					.finally(() => pingQueuePeerIds.delete(id))

				if (active) {
					successCount++
				} else {
					failureCount++
				}
			}
		}

		return [successCount, failureCount]
	}

	const { routingTable: wanRoutingTable, protocol: wanProtocol } = libp2p.dht.wan as KadDHT
	const { routingTable: lanRoutingTable, protocol: lanProtocol } = libp2p.dht.lan as KadDHT

	wanRoutingTable.kb?.on("added", ({ peer }) => {
		if (peer.equals(libp2p.peerId)) {
			return
		}

		const id = peer.toString()
		if (pingQueuePeerIds.has(id)) {
			return
		}

		if (verbose) {
			console.log(prefix, `Adding ${peer} to ping queue #${pingQueue.size}`)
		}

		pingQueuePeerIds.add(id)
		pingQueue.add(() => ping(peer, wanProtocol, wanRoutingTable)).finally(() => pingQueuePeerIds.delete(id))
	})

	lanRoutingTable.kb?.on("added", ({ peer }) => {
		if (peer.equals(libp2p.peerId)) {
			return
		}

		const id = peer.toString()
		if (pingQueuePeerIds.has(id)) {
			return
		}

		if (verbose) {
			console.log(prefix, `Adding ${peer} to ping queue #${pingQueue.size}`)
		}

		pingQueuePeerIds.add(id)
		pingQueue.add(() => ping(peer, wanProtocol, lanRoutingTable)).finally(() => pingQueuePeerIds.delete(id))
	})

	try {
		console.log(prefix, "Starting ping service")

		while (!options.signal?.aborted) {
			await wait(PING_INTERVAL, options)

			await lanRoutingTable.pingQueue.add(async () => {
				console.log(prefix, `Starting LAN routing table ping (${lanRoutingTable.size} entries)`)
				const [successCount, failureCount] = await pingTable(lanProtocol, lanRoutingTable)
				console.log(prefix, `Finished LAN routing table ping (${successCount} responses, ${failureCount} evicted)`)
			})

			await wanRoutingTable.pingQueue.add(async () => {
				console.log(prefix, `Starting WAN routing table ping (${wanRoutingTable.size} entries)`)
				const [successCount, failureCount] = await pingTable(wanProtocol, wanRoutingTable)
				console.log(prefix, `Finished WAN routing table ping (${successCount} responses, ${failureCount} evicted)`)
			})
		}
	} catch (err) {
		if (options.signal?.aborted) {
			console.log(prefix, `Service aborted`)
		} else {
			logErrorMessage(prefix, chalk.red(`Service crashed`), err)
		}
	}
}
