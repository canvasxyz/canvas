import { Libp2p } from "libp2p"
import { Connection } from "@libp2p/interface"
import { logger } from "@libp2p/logger"
import { anySignal } from "any-signal"

import { ServiceMap } from "./targets/interface.js"
import { PING_TIMEOUT } from "./constants.js"

const log = logger("canvas:core:ping")

export async function startPingService(
	libp2p: Libp2p<ServiceMap>,
	interval: number,
	options: { signal?: AbortSignal } = {},
) {
	log("starting ping service")

	const pingTimers = new Map<string, NodeJS.Timeout>()

	const handleConnectionOpen = ({ detail: connection }: CustomEvent<Connection>) => {
		const timer = setInterval(() => ping(libp2p, connection, options), interval)
		pingTimers.set(connection.id, timer)
	}
	const handleConnectionClose = ({ detail: connection }: CustomEvent<Connection>) =>
		clearInterval(pingTimers.get(connection.id))

	libp2p.addEventListener("connection:open", handleConnectionOpen)
	libp2p.addEventListener("connection:close", handleConnectionClose)

	options.signal?.addEventListener(
		"abort",
		() => {
			pingTimers.forEach((timer) => clearInterval(timer))
			pingTimers.clear()
			libp2p.removeEventListener("connection:open", handleConnectionOpen)
			libp2p.removeEventListener("connection:close", handleConnectionClose)
		},
		{ once: true },
	)
}

async function ping(libp2p: Libp2p<ServiceMap>, connection: Connection, options: { signal?: AbortSignal } = {}) {
	if (connection.transient) {
		return
	}

	log("pinging %p", connection.remotePeer)
	const signal = anySignal([AbortSignal.timeout(PING_TIMEOUT), options.signal])
	try {
		const ms = await libp2p.services.ping.ping(connection.remoteAddr, { signal })
		log("received response from %p on %s in %dms", connection.remotePeer, connection.id, ms)
	} catch (err) {
		log("no response from %p, aborting connection %s", connection.remotePeer, connection.id)
		connection.abort(new Error("PING_TIMEOUT"))
	} finally {
		signal.clear()
	}
}
