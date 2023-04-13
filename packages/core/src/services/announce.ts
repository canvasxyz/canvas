import chalk from "chalk"
import { CID } from "multiformats"
import { Libp2p } from "libp2p"
import { TimeoutController } from "timeout-abort-controller"
import { anySignal } from "any-signal"

import { wait, retry, logErrorMessage } from "@canvas-js/core/utils"
import { ANNOUNCE_DELAY, ANNOUNCE_INTERVAL, ANNOUNCE_RETRY_INTERVAL, ANNOUNCE_TIMEOUT } from "@canvas-js/core/constants"

/**
 * This starts the "announce service", an async while loop that calls this.announce()
 * every constants.ANNOUNCE_INTERVAL milliseconds
 */
export async function startAnnounceService(libp2p: Libp2p, cid: CID, options: { signal?: AbortSignal } = {}) {
	const prefix = chalk.hex("#FF8800")(`[canvas-core] [${cid}] [announce]`)
	console.log(prefix, `Staring service`)

	try {
		await wait(ANNOUNCE_DELAY, options)
		while (!options.signal?.aborted) {
			await retry(
				() => announce(libp2p, cid, options),
				(err) => logErrorMessage(prefix, chalk.yellow(`Failed to publish DHT provider record`), err),
				{ ...options, interval: ANNOUNCE_RETRY_INTERVAL }
			)

			await wait(ANNOUNCE_INTERVAL, options)
		}
	} catch (err) {
		if (options.signal?.aborted) {
			console.log(prefix, `Service aborted`)
		} else {
			logErrorMessage(prefix, chalk.red(`Service crashed`), err)
		}
	}
}

/**
 * Publish a provider record to the DHT announcing us as an application peer.
 */
async function announce(libp2p: Libp2p, cid: CID, options: { signal?: AbortSignal } = {}): Promise<void> {
	const prefix = chalk.hex("#FF8800")(`[canvas-core] [${cid}] [announce]`)
	console.log(prefix, `Publishing DHT provider record...`)

	const timeoutController = new TimeoutController(ANNOUNCE_TIMEOUT)
	const signal = anySignal([timeoutController.signal, options.signal])

	try {
		await libp2p.contentRouting.provide(cid, { signal: signal })
		console.log(prefix, chalk.green(`Successfully published DHT provider record.`))
	} finally {
		signal.clear()
		timeoutController.clear()
	}
}
