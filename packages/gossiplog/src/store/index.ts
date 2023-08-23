import { IPLDValue } from "@canvas-js/interfaces"

import { GossipLog, GossipLogInit, GossipLogComponents } from "../GossipLog.js"

export function gossiplog<Payload extends IPLDValue>({}: GossipLogInit<Payload>): (
	components: GossipLogComponents
) => GossipLog<Payload> {
	throw new Error("unsupported platform")
}
