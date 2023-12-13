import { Libp2p } from "libp2p"
import { Connection } from "@libp2p/interface"
import { logger } from "@libp2p/logger"

import { ServiceMap } from "./targets/interface.js"
import { wait } from "./utils.js"

const log = logger("canvas:core:ping")

export async function startPingService(libp2p: Libp2p<ServiceMap>, signal: AbortSignal, interval: number) {
	log("starting ping service")
	while (signal.aborted === false) {
		await wait(interval, { signal })
		await Promise.all(libp2p.getConnections().map((connection) => ping(libp2p, signal, connection)))
	}
}

async function ping(libp2p: Libp2p<ServiceMap>, signal: AbortSignal, connection: Connection) {
	if (connection.transient) {
		return
	}

	log("pinging %p", connection.remotePeer)
	try {
		const ms = await libp2p.services.ping.ping(connection.remoteAddr)
		log("received response from %p on %s in %dms", connection.remotePeer, connection.id, ms)
	} catch (err) {
		log("no response from %p, aborting connection %s", connection.remotePeer, connection.id)
		connection.abort(new Error("PING_TIMEOUT"))
	}
}
