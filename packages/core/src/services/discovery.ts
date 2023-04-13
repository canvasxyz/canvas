import chalk from "chalk"
import { CID } from "multiformats"
import { Libp2p } from "libp2p"
import { TimeoutController } from "timeout-abort-controller"
import { PeerId } from "@libp2p/interface-peer-id"

import { wait, retry, AbortError, logErrorMessage } from "@canvas-js/core/utils"
import {
	DISCOVERY_DELAY,
	DISCOVERY_INTERVAL,
	DISCOVERY_RETRY_INTERVAL,
	DISCOVERY_TIMEOUT,
} from "@canvas-js/core/constants"

/**
 * This starts the "discovery service", an async while loop that calls this.discover()
 * every constants.ANNOUNCE_INTERVAL milliseconds
 */
export async function startDiscoveryService(
	libp2p: Libp2p,
	cid: CID,
	signal: AbortSignal,
	callback?: (peerId: PeerId) => void
) {
	const prefix = chalk.cyan(`[canvas-core] [${cid}] [discovery]`)
	console.log(prefix, `Staring discovery service`)

	try {
		await wait({ interval: DISCOVERY_DELAY, signal })
		while (!signal.aborted) {
			await retry(
				async () => await discover(libp2p, cid, signal, callback),
				(err) => logErrorMessage(prefix, chalk.yellow(`Failed to query DHT for provider records`), err),
				{ signal, interval: DISCOVERY_RETRY_INTERVAL }
			)

			await wait({ interval: DISCOVERY_INTERVAL, signal })
		}
	} catch (err) {
		if (err instanceof AbortError || signal.aborted) {
			console.log(prefix, `Service aborted`)
		} else {
			logErrorMessage(prefix, chalk.red(`Service crashed`), err)
		}
	}
}

async function discover(
	libp2p: Libp2p,
	cid: CID,
	signal: AbortSignal,
	callback?: (peerId: PeerId) => void
): Promise<void> {
	const prefix = chalk.cyan(`[canvas-core] [${cid}] [discovery]`)
	console.log(prefix, `Querying DHT for provider records...`)

	const queryController = new TimeoutController(DISCOVERY_TIMEOUT)
	const abort = () => queryController.abort()
	signal.addEventListener("abort", abort)

	const queryOptions = { signal: queryController.signal }

	try {
		for await (const { id } of libp2p.contentRouting.findProviders(cid, queryOptions)) {
			if (libp2p.peerId.equals(id)) {
				continue
			} else {
				console.log(prefix, `Found application peer ${id}`)
				if (callback !== undefined) {
					callback(id)
				}
			}
		}
	} finally {
		queryController.clear()
		signal.removeEventListener("abort", abort)
	}
}
