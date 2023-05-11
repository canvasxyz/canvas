import { SignedDiscoveryRecord } from "#protocols/discovery"

export interface DiscoveryRecordCache {
	insert(topics: string[], record: SignedDiscoveryRecord): void
	query(topic: string): SignedDiscoveryRecord[]
}
