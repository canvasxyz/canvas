import type { Libp2p } from "libp2p"
import type { PeerId } from "@libp2p/interface"
import type { GossipLogInit } from "@canvas-js/gossiplog"
import type { PlatformTarget, ServiceMap } from "../interface.js"

export default {
	async openDB(location, models, { indexHistory } = {}) {
		throw new Error("Unsupported platform")
	},

	async openGossipLog<Payload, Result>(
		location: { path: string | null; topic: string },
		init: GossipLogInit<Payload, Result>,
	) {
		throw new Error("Unsupported platform")
	},

	async createLibp2p(location: { topic: string; path: string | null }, options): Promise<Libp2p<ServiceMap>> {
		throw new Error("Unsupported platform")
	},
} satisfies PlatformTarget
