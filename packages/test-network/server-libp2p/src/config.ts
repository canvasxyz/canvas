import assert from "node:assert"

import { multiaddr } from "@multiformats/multiaddr"

const { BOOTSTRAP_LIST, LISTEN, ANNOUNCE, TOPIC, DELAY = "0", INTERVAL = "0" } = process.env

export const delay = parseInt(DELAY) * 1000
export const interval = parseInt(INTERVAL) * 1000

export const bootstrapList = BOOTSTRAP_LIST?.split(" ") ?? []

assert(typeof TOPIC === "string")
export const topic = TOPIC

for (const address of bootstrapList) {
	const ma = multiaddr(address)
	const peerId = ma.getPeerId()

	if (peerId === null) {
		throw new Error("Invalid bootstrap peer address: must identify peer id using /p2p")
	}
}

export const listen = LISTEN?.split(" ") ?? ["/ip4/0.0.0.0/tcp/8080/ws"]

console.log("listening on", listen)

export const announce = ANNOUNCE?.split(" ") ?? []

console.log("announcing on", announce)
