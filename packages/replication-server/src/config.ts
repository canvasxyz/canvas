import fs from "node:fs"
import path from "node:path"
import process from "node:process"

import { PeerId } from "@libp2p/interface"
import { createFromProtobuf, createEd25519PeerId } from "@libp2p/peer-id-factory"
import { multiaddr } from "@multiformats/multiaddr"

import dotenv from "dotenv"

dotenv.config()

const { PEER_ID, BOOTSTRAP_LIST, LISTEN, ANNOUNCE, DISCOVERY_TOPIC, DATA_DIRECTORY, RESTART_AT, PORT, MAX_TOPICS } =
	process.env

export const maxTopics = 90 ?? MAX_TOPICS

console.log("[replication-server] Initializing with max topics:", maxTopics)

export const port = parseInt(PORT ?? "8000")

export const restartAt = RESTART_AT ?? null

export const dataDirectory = DATA_DIRECTORY ?? path.resolve(process.cwd(), "data")
if (!fs.existsSync(dataDirectory)) {
	console.log("[replication-server] Creating data directory at", dataDirectory)
	fs.mkdirSync(dataDirectory, { recursive: true })
}

export const discoveryTopic = DISCOVERY_TOPIC ?? "canvas-discovery"

async function getPeerId() {
	if (typeof PEER_ID === "string") {
		return await createFromProtobuf(Buffer.from(PEER_ID, "base64"))
	} else {
		return await createEd25519PeerId()
	}
}

export const peerId: PeerId = await getPeerId()

export const bootstrapList = BOOTSTRAP_LIST === undefined ? [] : BOOTSTRAP_LIST.split(" ")

for (const address of bootstrapList) {
	const ma = multiaddr(address)
	const peerId = ma.getPeerId()

	if (peerId === null) {
		throw new Error("Invalid bootstrap peer address: must identify peer id using /p2p")
	}
}

export const listen: string[] = []
if (typeof LISTEN === "string") {
	listen.push(LISTEN)
} else {
	listen.push(`/ip4/127.0.0.1/tcp/8080/ws`)
}

export const announce: string[] = []
if (typeof ANNOUNCE === "string") {
	announce.push(ANNOUNCE)
}
