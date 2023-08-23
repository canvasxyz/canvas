import { IPLDValue } from "@canvas-js/interfaces"

import { GossipLog, GossipLogInit, GossipLogComponents } from "../gossiplog.js"

export function gossiplog<Payload extends IPLDValue>({}: GossipLogInit<Payload>): (
	components: GossipLogComponents
) => GossipLog<Payload> {
	throw new Error("unsupported platform")
}
