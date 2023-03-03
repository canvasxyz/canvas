import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"

export async function getLibp2pOptions(config: {
	peerId?: PeerId
	port?: number
	announce?: string[]
	bootstrapList?: string[]
}): Promise<Libp2pOptions> {
	throw new Error("not implemented")
}
