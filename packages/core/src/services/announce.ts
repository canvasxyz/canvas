import chalk from "chalk"
import { CID } from "multiformats"
import { Libp2p } from "libp2p"
import { TimeoutController } from "timeout-abort-controller"

import { wait, retry, AbortError, getErrorMessage } from "@canvas-js/core/utils"
import { ANNOUNCE_DELAY, ANNOUNCE_INTERVAL, ANNOUNCE_RETRY_INTERVAL, ANNOUNCE_TIMEOUT } from "@canvas-js/core/constants"

/**
 * This starts the "announce service", an async while loop that calls this.announce()
 * every constants.ANNOUNCE_INTERVAL milliseconds
 */
export async function startAnnounceService(libp2p: Libp2p, cid: CID, signal: AbortSignal) {
	const prefix = chalk.hex("#FF8800")(`[canvas-core] [${cid}] [announce]`)
	console.log(prefix, `Staring service`)

	try {
		await wait({ interval: ANNOUNCE_DELAY, signal })
		while (!signal.aborted) {
			await retry(
				() => announce(libp2p, cid, signal),
				(err) => console.log(prefix, chalk.yellow(`Failed to publish DHT provider record (${getErrorMessage(err)})`)),
				{ signal, interval: ANNOUNCE_RETRY_INTERVAL }
			)

			await wait({ interval: ANNOUNCE_INTERVAL, signal })
		}
	} catch (err) {
		if (err instanceof AbortError || signal.aborted) {
			console.log(prefix, `Service aborted`)
		} else {
			const msg = getErrorMessage(err)
			console.log(prefix, chalk.red(`Service crashed (${msg})`))
		}
	}
}

/**
 * Publish a provider record to the DHT announcing us as an application peer.
 */
async function announce(libp2p: Libp2p, cid: CID, signal: AbortSignal): Promise<void> {
	const prefix = chalk.hex("#FF8800")(`[canvas-core] [${cid}] [announce]`)
	console.log(prefix, `Publishing DHT provider record...`)

	const queryController = new TimeoutController(ANNOUNCE_TIMEOUT)
	const abort = () => queryController.abort()
	signal.addEventListener("abort", abort)
	try {
		await libp2p.contentRouting.provide(cid, { signal: queryController.signal })
		console.log(prefix, chalk.green(`Successfully published DHT provider record.`))
	} finally {
		queryController.clear()
		signal.removeEventListener("abort", abort)
	}
}
