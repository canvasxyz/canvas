import type { PeerId } from "@libp2p/interface-peer-id"

export interface P2PConfig {
	peerId: PeerId
	listen?: string[]
	announce?: string[]
	bootstrapList?: string[]
	disableDHT?: boolean
}
