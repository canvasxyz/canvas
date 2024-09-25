import process from "node:process"

import { PeerId } from "@libp2p/interface"
import { createFromProtobuf, createEd25519PeerId } from "@libp2p/peer-id-factory"

const { DATABASE_PATH, PEER_ID, LISTEN, ANNOUNCE, MIN_CONNECTIONS, MAX_CONNECTIONS } = process.env

export interface Config {
	path: string | null
	peerId: PeerId
	listen: string[]
	announce: string[]
	minConnections: number
	maxConnections: number
}

export async function getConfig(config: Partial<Config>): Promise<Config> {
	const path = DATABASE_PATH ?? null

	let peerId = config.peerId
	if (peerId === undefined) {
		peerId = await getPeerId()
	}

	let { minConnections = 0, maxConnections = 1024 } = config
	if (MIN_CONNECTIONS !== undefined) minConnections = parseInt(MIN_CONNECTIONS)
	if (MAX_CONNECTIONS !== undefined) maxConnections = parseInt(MAX_CONNECTIONS)

	const listen = config.listen ?? LISTEN?.split(",") ?? ["/ip4/127.0.0.1/tcp/8080/ws"]
	const announce = config.announce ?? ANNOUNCE?.split(",") ?? []

	return { path, peerId, listen, announce, minConnections, maxConnections }
}

async function getPeerId(): Promise<PeerId> {
	if (typeof PEER_ID === "string") {
		return await createFromProtobuf(Buffer.from(PEER_ID, "base64"))
	} else {
		return await createEd25519PeerId()
	}
}
