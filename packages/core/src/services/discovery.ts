import chalk from "chalk"
import { CID } from "multiformats"
import { Libp2p } from "libp2p"
import { TimeoutController } from "timeout-abort-controller"
import { PeerId } from "@libp2p/interface-peer-id"

import { wait, retry, AbortError } from "@canvas-js/core/utils"
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
	callback?: (peers: PeerId[]) => void
) {
	const prefix = chalk.cyan(`[canvas-core] [${cid}] [discovery]`)
	console.log(prefix, `Staring discovery service`)

	try {
		await wait({ interval: DISCOVERY_DELAY, signal })
		while (!signal.aborted) {
			const peers = await retry(
				async () => await discover(libp2p, cid, signal),
				(err) => console.log(prefix, chalk.yellow(`Failed to query DHT for provider records (${err.message})`)),
				{ signal, interval: DISCOVERY_RETRY_INTERVAL }
			)

			if (callback !== undefined) {
				callback(peers)
			}

			await wait({ interval: DISCOVERY_INTERVAL, signal })
		}
	} catch (err) {
		if (err instanceof AbortError || signal.aborted) {
			console.log(prefix, `Aborting service`)
		} else if (err instanceof Error) {
			console.log(prefix, chalk.red(`Service crashed (${err.message})`))
		} else {
			throw err
		}
	}
}

async function discover(libp2p: Libp2p, cid: CID, signal: AbortSignal): Promise<PeerId[]> {
	const prefix = chalk.cyan(`[canvas-core] [${cid}] [discovery]`)
	console.log(prefix, `Querying DHT for provider records...`)

	const queryController = new TimeoutController(DISCOVERY_TIMEOUT)
	const abort = () => queryController.abort()
	signal.addEventListener("abort", abort)

	const queryOptions = { signal: queryController.signal }

	try {
		const peers: PeerId[] = []
		for await (const { id } of libp2p.contentRouting.findProviders(cid, queryOptions)) {
			console.log(prefix, `Found application peer ${id}`)
			peers.push(id)
		}

		return peers
	} finally {
		queryController.clear()
		signal.removeEventListener("abort", abort)
	}
}
