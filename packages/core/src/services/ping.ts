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

export interface PingServiceInit {
	libp2p: Libp2p
	signal: AbortSignal
	verbose?: boolean
}

export async function startPingService({ libp2p, signal, verbose }: PingServiceInit) {
	const prefix = chalk.magentaBright(`[canvas-core] [ping]`)

	const pingQueuePeerIds = new Set<string>()
	const pingQueue = new PQueue({ concurrency: 1 })

	signal.addEventListener("abort", () => {
		pingQueue.pause()
		pingQueue.clear()
	})

	async function ping(peer: PeerId, routingTable: RoutingTable): Promise<boolean> {
		if (peer.equals(libp2p.peerId)) {
			return true
		}

		const timeoutSignal = anySignal([AbortSignal.timeout(PING_TIMEOUT), signal])

		try {
			const latency = await libp2p.ping(peer, { signal: timeoutSignal })
			if (verbose) {
				console.log(prefix, `${peer} responded in ${latency}ms`)
			}

			return true
		} catch (err) {
			if (verbose) {
				logErrorMessage(prefix, `${peer} did not respond to ping`, err)
			}

			if (routingTable.isStarted()) {
				await routingTable.remove(peer)
				await libp2p.peerStore.delete(peer)
			}

			return false
		} finally {
			timeoutSignal.clear()
		}
	}

	async function pingTable(routingTable: RoutingTable): Promise<[successCount: number, failureCount: number]> {
		const contacts = [...forContacts(routingTable)]

		let successCount = 0
		let failureCount = 0

		for (const peer of contacts) {
			const id = peer.toString()
			if (pingQueuePeerIds.has(id)) {
				continue
			}

			if (verbose) {
				console.log(prefix, `Adding ${peer} to ping queue (${pingQueue.size} pending)`)
			}

			pingQueuePeerIds.add(id)

			const active = await pingQueue.add(() => ping(peer, routingTable)).finally(() => pingQueuePeerIds.delete(id))

			if (active) {
				successCount++
			} else {
				failureCount++
			}
		}

		return [successCount, failureCount]
	}

	function attachRoutingTableListener(routingTable: RoutingTable) {
		if (routingTable.kb === undefined) {
			return
		}

		routingTable.kb.on("added", ({ peer }) => {
			if (peer.equals(libp2p.peerId)) {
				return
			}

			const id = peer.toString()
			if (pingQueuePeerIds.has(id)) {
				return
			}

			if (verbose) {
				console.log(prefix, `Adding ${peer} to ping queue (${pingQueue.size} pending)`)
			}

			pingQueuePeerIds.add(id)
			pingQueue.add(() => ping(peer, routingTable)).finally(() => pingQueuePeerIds.delete(id))
		})
	}

	const { routingTable: wanRoutingTable } = libp2p.dht.wan as KadDHT
	const { routingTable: lanRoutingTable } = libp2p.dht.lan as KadDHT

	attachRoutingTableListener(wanRoutingTable)
	attachRoutingTableListener(lanRoutingTable)

	try {
		console.log(prefix, "Starting ping service")

		while (!signal.aborted) {
			await wait(PING_INTERVAL, { signal })

			console.log(prefix, `Starting LAN routing table ping (${lanRoutingTable.size} entries)`)
			const [lanSuccessCount, lanFailureCount] = await pingTable(lanRoutingTable)
			console.log(prefix, `Finished LAN routing table ping (${lanSuccessCount} responses, ${lanFailureCount} evicted)`)

			console.log(prefix, `Starting WAN routing table ping (${wanRoutingTable.size} entries)`)
			const [wanSuccessCount, wanFailureCount] = await pingTable(wanRoutingTable)
			console.log(prefix, `Finished WAN routing table ping (${wanSuccessCount} responses, ${wanFailureCount} evicted)`)
		}
	} catch (err) {
		if (signal.aborted) {
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
