import type { PeerId } from "@libp2p/interface/peer-id"
import type { Awaitable } from "@canvas-js/interfaces"

export interface TopicCache {
	observe(topic: string, peerId: PeerId): void
	identify(peerId: PeerId, peerRecordEnvelope: Uint8Array): void
	query(topic: string): Awaitable<{ peerId: PeerId; peerRecordEnvelope?: Uint8Array }[]>
}
