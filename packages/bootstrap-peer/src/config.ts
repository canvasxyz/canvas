import process from "node:process"

import { PrivateKey } from "@libp2p/interface"
import { generateKeyPair, privateKeyFromProtobuf } from "@libp2p/crypto/keys"

const { DATABASE_PATH, LIBP2P_PRIVATE_KEY, LISTEN, ANNOUNCE, MAX_CONNECTIONS } = process.env

export interface Config {
	path: string | null
	privateKey: PrivateKey
	listen: string[]
	announce: string[]
	maxConnections: number
}

export async function getConfig(config: Partial<Config>): Promise<Config> {
	const path = DATABASE_PATH ?? null

	let privateKey = config.privateKey
	if (privateKey === undefined) {
		privateKey = await getPrivateKey()
	}

	let { maxConnections = 1024 } = config
	if (MAX_CONNECTIONS !== undefined) maxConnections = parseInt(MAX_CONNECTIONS)

	const listen = config.listen ?? LISTEN?.split(",") ?? ["/ip4/127.0.0.1/tcp/8080/ws"]
	const announce = config.announce ?? ANNOUNCE?.split(",") ?? []

	return { path, privateKey, listen, announce, maxConnections }
}

async function getPrivateKey(): Promise<PrivateKey> {
	if (typeof LIBP2P_PRIVATE_KEY === "string") {
		return privateKeyFromProtobuf(Buffer.from(LIBP2P_PRIVATE_KEY, "base64"))
	} else {
		return await generateKeyPair("Ed25519")
	}
}
