import chalk from "chalk"

import type { Libp2p } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"
import type { kadDHT } from "@libp2p/kad-dht"

type DualKadDHT = ReturnType<ReturnType<typeof kadDHT>>
type KadDHT = DualKadDHT["wan"]
type RoutingTable = KadDHT["routingTable"]

import { TimeoutController } from "timeout-abort-controller"

import { AbortError, logErrorMessage, wait } from "@canvas-js/core/utils"
import { PING_INTERVAL, PING_TIMEOUT } from "@canvas-js/core/constants"

function* forContacts(routingTable: RoutingTable): Iterable<PeerId> {
	if (routingTable.kb === undefined) {
		return
	}

	for (const contact of routingTable.kb.toIterable()) {
		const { peer } = contact as unknown as { id: Uint8Array; peer: PeerId }
		yield peer
	}
}

export async function startPingService(libp2p: Libp2p, signal: AbortSignal, { verbose }: { verbose?: boolean } = {}) {
	const prefix = chalk.hex("#dabaf7")(`[canvas-core] [ping]`)

	async function ping(peer: PeerId, protocol: string) {
		if (peer.equals(libp2p.peerId)) {
			return
		}

		const timeoutController = new TimeoutController(PING_TIMEOUT)
		const abort = () => timeoutController.abort()
		signal.addEventListener("abort", abort)

		try {
			const stream = await libp2p.dialProtocol(peer, protocol, { signal: timeoutController.signal })
			stream.close()
		} finally {
			signal.removeEventListener("abort", abort)
		}
	}

	async function pingTable(
		protocol: string,
		routingTable: RoutingTable
	): Promise<[successCount: number, failureCount: number]> {
		let successCount = 0
		let failureCount = 0
		let peerIndex = 0

		for (const peer of forContacts(routingTable)) {
			if (verbose) {
				console.log(prefix, `Ping ${peer} (${++peerIndex}/${routingTable.size})`)
			}

			try {
				await ping(peer, protocol)
				if (verbose) {
					console.log(prefix, `Ping ${peer} succeeded`)
				}

				successCount += 1
			} catch (err) {
				if (verbose) {
					logErrorMessage(prefix, `Ping ${peer} failed`, err)
				}

				if (routingTable.isStarted()) {
					failureCount += 1
					await routingTable.remove(peer)
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

		wanRoutingTable.pingQueue.add(async () => {
			if (verbose) {
				console.log(prefix, `Ping ${peer}`)
			}

			try {
				await ping(peer, wanProtocol)
				if (verbose) {
					console.log(prefix, `Ping ${peer} succeeded`)
				}
			} catch (err) {
				if (verbose) {
					logErrorMessage(prefix, `Ping ${peer} failed`, err)
				}

				if (wanRoutingTable.isStarted()) {
					await wanRoutingTable.remove(peer)
				}
			}
		})
	})

	lanRoutingTable.kb?.on("added", ({ peer }) => {
		if (peer.equals(libp2p.peerId)) {
			return
		}

		lanRoutingTable.pingQueue.add(async () => {
			if (verbose) {
				console.log(prefix, `Ping ${peer}`)
			}

			try {
				await ping(peer, lanProtocol)
				if (verbose) {
					console.log(prefix, `Ping ${peer} succeeded`)
				}
			} catch (err) {
				if (verbose) {
					logErrorMessage(prefix, `Ping ${peer} failed`, err)
				}

				if (lanRoutingTable.isStarted()) {
					await lanRoutingTable.remove(peer)
				}
			}
		})
	})

	try {
		console.log(prefix, "Starting ping service")

		while (!signal.aborted) {
			await wait({ signal, interval: PING_INTERVAL })

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
		if (err instanceof AbortError || signal.aborted) {
			console.log(prefix, `Service aborted`)
		} else {
			logErrorMessage(prefix, chalk.red(`Service crashed`), err)
		}
	}
}
