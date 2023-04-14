import chalk from "chalk"

import type { Libp2p } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"
import type { kadDHT } from "@libp2p/kad-dht"

import PQueue from "p-queue"
import { anySignal } from "any-signal"

type DualKadDHT = ReturnType<ReturnType<typeof kadDHT>>
type KadDHT = DualKadDHT["wan"]
type RoutingTable = KadDHT["routingTable"]

import { logErrorMessage, wait } from "@canvas-js/core/utils"
import { PING_INTERVAL, PING_TIMEOUT } from "@canvas-js/core/constants"

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

	async function ping(peer: PeerId, routingTable: RoutingTable): Promise<boolean> {
		if (peer.equals(libp2p.peerId)) {
			return true
		}

		const signal = anySignal([AbortSignal.timeout(PING_TIMEOUT), options.signal])

		try {
			const latency = await libp2p.ping(peer, { signal })
			if (verbose) {
				console.log(prefix, `${peer} responded in ${latency}ms`)
			}

			return true
		} catch (err) {
			if (verbose) {
				logErrorMessage(prefix, `${peer} did not response to ping`, err)
			}

			if (routingTable.isStarted()) {
				await libp2p.hangUp(peer)
				await routingTable.remove(peer)
			}

			return false
		} finally {
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

				const active = await pingQueue.add(() => ping(peer, routingTable)).finally(() => pingQueuePeerIds.delete(id))

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
		pingQueue.add(() => ping(peer, wanRoutingTable)).finally(() => pingQueuePeerIds.delete(id))
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
		pingQueue.add(() => ping(peer, lanRoutingTable)).finally(() => pingQueuePeerIds.delete(id))
	})

	try {
		console.log(prefix, "Starting ping service")

		while (!options.signal?.aborted) {
			await wait(PING_INTERVAL, options)

			console.log(prefix, `Starting LAN routing table ping (${lanRoutingTable.size} entries)`)
			const [lanSuccessCount, lanFailureCount] = await pingTable(lanProtocol, lanRoutingTable)
			console.log(prefix, `Finished LAN routing table ping (${lanSuccessCount} responses, ${lanFailureCount} evicted)`)

			console.log(prefix, `Starting WAN routing table ping (${wanRoutingTable.size} entries)`)
			const [wanSuccessCount, wanFailureCount] = await pingTable(wanProtocol, wanRoutingTable)
			console.log(prefix, `Finished WAN routing table ping (${wanSuccessCount} responses, ${wanFailureCount} evicted)`)
		}
	} catch (err) {
		if (options.signal?.aborted) {
			console.log(prefix, `Service aborted`)
		} else {
			logErrorMessage(prefix, chalk.red(`Service crashed`), err)
		}
	}
}

function* forContacts(routingTable: RoutingTable): Iterable<PeerId> {
	if (routingTable.kb === undefined) {
		return
	}

	for (const contact of routingTable.kb.toIterable()) {
		yield contact.peer
	}
}
