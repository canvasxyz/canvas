import type { Libp2p } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"
import type { kadDHT } from "@libp2p/kad-dht"

type DualKadDHT = ReturnType<ReturnType<typeof kadDHT>>
type KadDHT = DualKadDHT["wan"]
type RoutingTable = KadDHT["routingTable"]

import { TimeoutController } from "timeout-abort-controller"

import { AbortError, wait } from "../../utils.js"
import { DHT_PING_INTERVAL, PING_PEER_TIMEOUT } from "../../constants.js"

function* forContacts(routingTable: RoutingTable): Iterable<PeerId> {
	if (routingTable.kb === undefined) {
		return
	}

	for (const contact of routingTable.kb.toIterable()) {
		const { peer } = contact as unknown as { id: Uint8Array; peer: PeerId }
		yield peer
	}
}

export async function startPingService(
	libp2p: Libp2p,
	controller: AbortController,
	{ verbose }: { verbose?: boolean } = {}
) {
	async function ping(peer: PeerId, protocol: string) {
		const timeoutController = new TimeoutController(PING_PEER_TIMEOUT)
		const abort = () => timeoutController.abort()
		controller.signal.addEventListener("abort", abort)

		try {
			const connection = await libp2p.dial(peer, { signal: timeoutController.signal })
			const stream = await connection.newStream(protocol, { signal: timeoutController.signal })
			stream.close()
		} finally {
			controller.signal.removeEventListener("abort", abort)
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
				await ping(peer, protocol)
				if (verbose) {
					console.log(`[canvas-core] Ping ${peer.toString()} succeeded`)
				}

				successCount += 1
			} catch (err) {
				if (err instanceof Error) {
					if (routingTable.isStarted()) {
						if (verbose) {
							console.log(`[canvas-core] Ping ${peer.toString()} failed (${err.message})`)
						}

						failureCount += 1
						await routingTable.remove(peer)
					}
				} else {
					throw err
				}
			}
		}

		return [successCount, failureCount]
	}

	const { routingTable: wanRoutingTable, protocol: wanProtocol } = libp2p.dht.wan as KadDHT
	const { routingTable: lanRoutingTable, protocol: lanProtocol } = libp2p.dht.lan as KadDHT

	wanRoutingTable.kb?.on("added", ({ peer }) => {
		wanRoutingTable.pingQueue.add(async () => {
			if (peer.equals(libp2p.peerId)) {
				return
			}

			if (verbose) {
				console.log(`[canvas-core] Ping ${peer.toString()}`)
			}

			try {
				await ping(peer, wanProtocol)
				if (verbose) {
					console.log(`[canvas-core] Ping ${peer.toString()} succeeded`)
				}
			} catch (err) {
				if (err instanceof Error) {
					if (wanRoutingTable.isStarted()) {
						if (verbose) {
							console.log(`[canvas-core] Ping ${peer.toString()} failed (${err.message})`)
						}

						await wanRoutingTable.remove(peer)
					}
				} else {
					throw err
				}
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
				await ping(peer, lanProtocol)
				if (verbose) {
					console.log(`[canvas-core] Ping ${peer.toString()} succeeded`)
				}
			} catch (err) {
				if (err instanceof Error) {
					if (lanRoutingTable.isStarted()) {
						if (verbose) {
							console.log(`[canvas-core] Ping ${peer.toString()} failed (${err.message})`)
						}

						await lanRoutingTable.remove(peer)
					}
				} else {
					throw err
				}
			}
		})
	})

	try {
		console.log("[canvas-core] Starting ping service")

		while (!controller.signal.aborted) {
			await wait({ signal: controller.signal, interval: DHT_PING_INTERVAL })

			await lanRoutingTable.pingQueue.add(async () => {
				console.log(`[canvas-core] Starting LAN routing table ping (${lanRoutingTable.size} entries)`)
				const [successCount, failureCount] = await pingTable(lanProtocol, lanRoutingTable)
				console.log(
					`[canvas-core] Finished LAN routing table ping (${successCount} responses, ${failureCount} evicted)`
				)
			})

			await wanRoutingTable.pingQueue.add(async () => {
				console.log(`[canvas-core] Starting WAN routing table ping (${wanRoutingTable.size} entries)`)
				const [successCount, failureCount] = await pingTable(wanProtocol, wanRoutingTable)
				console.log(
					`[canvas-core] Finished WAN routing table ping (${successCount} responses, ${failureCount} evicted)`
				)
			})
		}
	} catch (err) {
		if (err instanceof AbortError) {
			console.log("[canvas-core] Aborting ping service")
		} else if (err instanceof Error) {
			console.error(`[canvas-core] Ping service crashed (${err.message})`)
		} else {
			throw err
		}
	}
}
