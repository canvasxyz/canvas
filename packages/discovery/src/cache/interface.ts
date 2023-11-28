import type { PeerId } from "@libp2p/interface/peer-id"

export interface TopicCache {
	observe(topic: string, peerId: PeerId): void
	identify(peerId: PeerId, peerRecordEnvelope: Uint8Array): void
	query(topic: string): { peerId: PeerId; peerRecordEnvelope?: Uint8Array }[]
}
