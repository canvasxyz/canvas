import chalk from "chalk"
import type { Libp2p } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"
import { CID } from "multiformats"
import { anySignal } from "any-signal"

import { wait, retry, logErrorMessage } from "@canvas-js/core/utils"
import {
	DHT_DISCOVERY_DELAY,
	DHT_DISCOVERY_INTERVAL,
	DHT_DISCOVERY_RETRY_INTERVAL,
	DHT_DISCOVERY_TIMEOUT,
} from "@canvas-js/core/constants"

export interface DiscoveryServiceInit {
	libp2p: Libp2p
	cid: CID
	signal: AbortSignal
	callback?: (peerId: PeerId) => void
}

/**
 * This starts the "discovery service", an async while loop that calls discover()
 * every DHT_DISCOVERY_INTERVAL milliseconds.
 */
export async function startDiscoveryService(init: DiscoveryServiceInit) {
	const { cid, signal } = init

	const prefix = chalk.cyan(`[canvas-core] [${cid}] [discovery]`)
	console.log(prefix, `Staring DHT discovery service`)

	try {
		await wait(DHT_DISCOVERY_DELAY, { signal })
		while (!signal.aborted) {
			await retry(
				async () => await discover(init),
				(err) => logErrorMessage(prefix, chalk.yellow(`Failed to query DHT for provider records`), err),
				{ signal, interval: DHT_DISCOVERY_RETRY_INTERVAL, maxRetries: 3 }
			)

			await wait(DHT_DISCOVERY_INTERVAL, { signal })
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

	const timeoutSignal = anySignal([AbortSignal.timeout(DHT_DISCOVERY_TIMEOUT), signal])

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
