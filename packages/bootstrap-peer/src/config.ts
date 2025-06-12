import process from "node:process"

import { PrivateKey } from "@libp2p/interface"
import { generateKeyPair, privateKeyFromProtobuf } from "@libp2p/crypto/keys"

const {
	DATABASE_PATH,
	LIBP2P_PRIVATE_KEY,
	LISTEN,
	ANNOUNCE,
	MAX_CONNECTIONS,
	MAX_DISCOVER_LIMIT,
	MAX_REGISTRATION_TTL,
} = process.env

export interface Config {
	path: string | null
	privateKey: PrivateKey
	listen: string[]
	announce: string[]
	maxConnections: number

	maxRegistrationTTL?: number
	maxDiscoverLimit?: number
}

export async function getConfig(config: Partial<Config>): Promise<Config> {
	const path = config.path ?? DATABASE_PATH ?? null

	let privateKey = config.privateKey
	if (privateKey === undefined) {
		privateKey = await getPrivateKey()
	}

	let { maxConnections = 1024, maxRegistrationTTL, maxDiscoverLimit } = config
	if (MAX_CONNECTIONS !== undefined) maxConnections ??= parseInt(MAX_CONNECTIONS)
	if (MAX_REGISTRATION_TTL !== undefined) maxRegistrationTTL ??= parseInt(MAX_REGISTRATION_TTL)
	if (MAX_DISCOVER_LIMIT !== undefined) maxDiscoverLimit ??= parseInt(MAX_DISCOVER_LIMIT)

	const listen = config.listen ?? LISTEN?.split(",") ?? ["/ip4/127.0.0.1/tcp/8080/ws"]
	const announce = config.announce ?? ANNOUNCE?.split(",") ?? []

	return { path, privateKey, listen, announce, maxConnections, maxRegistrationTTL, maxDiscoverLimit }
}

async function getPrivateKey(): Promise<PrivateKey> {
	if (typeof LIBP2P_PRIVATE_KEY === "string") {
		return privateKeyFromProtobuf(Buffer.from(LIBP2P_PRIVATE_KEY, "base64"))
	} else {
		return await generateKeyPair("Ed25519")
	}
}
