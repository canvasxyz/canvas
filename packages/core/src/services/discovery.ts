import chalk from "chalk"
import type { Libp2p } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"
import { CID } from "multiformats"
import { anySignal } from "any-signal"

import { wait, retry, logErrorMessage, parseIPFSURI } from "@canvas-js/core/utils"
import {
	DISCOVERY_DELAY,
	DISCOVERY_INTERVAL,
	DISCOVERY_RETRY_INTERVAL,
	DISCOVERY_TIMEOUT,
} from "@canvas-js/core/constants"

export interface DiscoveryServiceInit {
	libp2p: Libp2p
	cid: CID
	topic: string
	signal: AbortSignal
	callback?: (peerId: PeerId) => void
}

/**
 * This starts the "discovery service", an async while loop that calls this.discover()
 * every constants.ANNOUNCE_INTERVAL milliseconds
 */
export async function startDiscoveryService(init: DiscoveryServiceInit) {
	const { libp2p, cid, topic, signal, callback } = init

	const prefix = chalk.cyan(`[canvas-core] [${cid}] [discovery]`)
	console.log(prefix, `Staring discovery service`)

	try {
		await wait(DISCOVERY_DELAY, { signal })
		while (!signal.aborted) {
			for (const peerId of libp2p.pubsub.getSubscribers(topic)) {
				if (callback !== undefined) {
					console.log(prefix, `Found peer ${peerId} via GossipSub subscription`)
					callback(peerId)
				}
			}

			await retry(
				async () => await discover(init),
				(err) => logErrorMessage(prefix, chalk.yellow(`Failed to query DHT for provider records`), err),
				{ signal, interval: DISCOVERY_RETRY_INTERVAL, maxRetries: 3 }
			)

			await wait(DISCOVERY_INTERVAL, { signal })
		}
	} catch (err) {
		if (signal.aborted) {
			console.log(prefix, `Service aborted`)
		} else {
			logErrorMessage(prefix, chalk.red(`Service crashed`), err)
		}
	}
}

async function discover(init: DiscoveryServiceInit): Promise<void> {
	const { libp2p, cid, signal, callback } = init

	const prefix = chalk.cyan(`[canvas-core] [${cid}] [discovery]`)
	console.log(prefix, `Querying DHT for provider records...`)

	const timeoutSignal = anySignal([AbortSignal.timeout(DISCOVERY_TIMEOUT), signal])

	try {
		for await (const { id } of libp2p.contentRouting.findProviders(cid, { signal: timeoutSignal })) {
			if (libp2p.peerId.equals(id)) {
				continue
			}

			console.log(prefix, `Found peer ${id} via DHT provider record`)
			if (callback !== undefined) {
				callback(id)
			}
		}
	} finally {
		timeoutSignal.clear()
	}
}
