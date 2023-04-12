import chalk from "chalk"
import { CID } from "multiformats"
import { Libp2p } from "libp2p"
import { TimeoutController } from "timeout-abort-controller"

import { wait, retry, AbortError } from "@canvas-js/core/utils"
import {
	DISCOVERY_DELAY,
	DISCOVERY_INTERVAL,
	DISCOVERY_RETRY_INTERVAL,
	DISCOVERY_TIMEOUT,
} from "@canvas-js/core/constants"
import { PeerId } from "@libp2p/interface-peer-id"

// /**
//  * This starts the "discovery service", an async while loop that calls this.discover()
//  * every constants.ANNOUNCE_INTERVAL milliseconds
//  */
// export async function startDiscoveryService(libp2p: Libp2p, cid: CID, signal: AbortSignal) {
// 	const prefix = chalk.cyan(`[canvas-core] [${cid}] [discovery]`)
// 	console.log(prefix, `Staring discovery service`)

// 	try {
// 		await wait({ interval: DISCOVERY_DELAY, signal })
// 		while (!signal.aborted) {
// 			await retry(
// 				async () => await getApplicationPeers(libp2p, cid, signal),
// 				(err) => console.log(prefix, chalk.yellow(`Failed to query DHT for provider records (${err.message})`)),
// 				{ signal, interval: DISCOVERY_RETRY_INTERVAL }
// 			)

// 			await wait({ interval: DISCOVERY_INTERVAL, signal })
// 		}
// 	} catch (err) {
// 		if (err instanceof AbortError || signal.aborted) {
// 			console.log(prefix, `Aborting service`)
// 		} else if (err instanceof Error) {
// 			console.log(prefix, chalk.red(`Service crashed (${err.message})`))
// 		} else {
// 			throw err
// 		}
// 	}
// }

export async function* getApplicationPeers(
	libp2p: Libp2p,
	cid: CID,
	signal: AbortSignal
): AsyncGenerator<PeerId, void, undefined> {
	const prefix = chalk.cyan(`[canvas-core] [${cid}] [discovery]`)
	console.log(prefix, `Querying DHT for provider records...`)

	const queryController = new TimeoutController(DISCOVERY_TIMEOUT)
	const abort = () => queryController.abort()
	signal.addEventListener("abort", abort)

	const queryOptions = { signal: queryController.signal }

	try {
		for await (const { id } of libp2p.contentRouting.findProviders(cid, queryOptions)) {
			console.log(prefix, `Found application peer ${id}`)
			yield id
		}
	} catch (err) {
		if (err instanceof Error) {
			console.log(prefix, chalk.yellow(`Failed to query DHT for provider records (${err.message})`))
			return
		} else {
			throw err
		}
	} finally {
		queryController.clear()
		signal.removeEventListener("abort", abort)
	}
}
