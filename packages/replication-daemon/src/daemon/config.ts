import fs from "node:fs"
import path from "node:path"
import process from "node:process"

import { PeerId } from "@libp2p/interface/peer-id"
import { createFromProtobuf, createEd25519PeerId } from "@libp2p/peer-id-factory"
import { multiaddr } from "@multiformats/multiaddr"

import dotenv from "dotenv"

dotenv.config()

const { PEER_ID, BOOTSTRAP_LIST, LISTEN, ANNOUNCE, DATA_DIRECTORY } = process.env

export const dataDirectory = DATA_DIRECTORY ?? path.resolve(process.cwd(), ".cache")
if (!fs.existsSync(dataDirectory)) {
	console.log("Creating data directory at", dataDirectory)
	fs.mkdirSync(dataDirectory, { recursive: true })
}

async function getPeerId(): Promise<PeerId> {
	if (typeof PEER_ID === "string") {
		return await createFromProtobuf(Buffer.from(PEER_ID, "base64"))
	} else {
		return await createEd25519PeerId()
	}
}

export const peerId = await getPeerId()

export const bootstrapList = BOOTSTRAP_LIST === undefined ? [] : BOOTSTRAP_LIST.split(" ")
console.log("using bootstrap list", bootstrapList)

for (const address of bootstrapList) {
	const ma = multiaddr(address)
	const peerId = ma.getPeerId()
	if (peerId === null) {
		throw new Error("Invalid bootstrap peer address: must identify peer id using /p2p")
	}
}

export const listen: string[] = []
if (typeof LISTEN === "string") {
	listen.push(...LISTEN.split(" "))
} else {
	listen.push(`/ip4/127.0.0.1/tcp/8080/ws`)
}

export const announce: string[] = []
if (typeof ANNOUNCE === "string") {
	announce.push(...ANNOUNCE.split(" "))
}
