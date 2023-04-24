// import chalk from "chalk"
// import { CID } from "multiformats"
// import { Libp2p } from "libp2p"
// import { anySignal } from "any-signal"

// import { wait, retry, logErrorMessage } from "@canvas-js/core/utils"
// import {
// 	DHT_ANNOUNCE_DELAY,
// 	DHT_ANNOUNCE_INTERVAL,
// 	DHT_ANNOUNCE_RETRY_INTERVAL,
// 	DHT_ANNOUNCE_TIMEOUT,
// } from "@canvas-js/core/constants"

// export interface AnnounceServiceInit {
// 	libp2p: Libp2p
// 	cid: CID
// 	signal: AbortSignal
// }

// /**
//  * This starts the "announce service", an async while loop that calls announce()
//  * every DHT_ANNOUNCE_INTERVAL milliseconds.
//  */
// export async function startAnnounceService({ libp2p, cid, signal }: AnnounceServiceInit) {
// 	const prefix = chalk.magentaBright(`[canvas-core] [${cid}] [announce]`)
// 	console.log(prefix, `Staring DHT announce service`)

// 	try {
// 		await wait(DHT_ANNOUNCE_DELAY, { signal })
// 		while (!signal.aborted) {
// 			await retry(
// 				async () => {
// 					console.log(prefix, `Publishing DHT provider record...`)
// 					await announce({ libp2p, cid, signal })
// 					console.log(prefix, chalk.green(`Successfully published DHT provider record.`))
// 				},
// 				(err) => logErrorMessage(prefix, chalk.yellow(`Failed to publish DHT provider record`), err),
// 				{ signal, interval: DHT_ANNOUNCE_RETRY_INTERVAL }
// 			)

// 			await wait(DHT_ANNOUNCE_INTERVAL, { signal })
// 		}
// 	} catch (err) {
// 		if (signal.aborted) {
// 			console.log(prefix, `Service aborted`)
// 		} else {
// 			logErrorMessage(prefix, chalk.red(`Service crashed`), err)
// 		}
// 	}
// }

// /**
//  * Publish a provider record to the DHT announcing us as an application peer.
//  */
// async function announce(init: AnnounceServiceInit): Promise<void> {
// 	const signal = anySignal([AbortSignal.timeout(DHT_ANNOUNCE_TIMEOUT), init.signal])
// 	try {
// 		await init.libp2p.contentRouting.provide(init.cid, { signal: signal })
// 	} finally {
// 		signal.clear()
// 	}
// }
