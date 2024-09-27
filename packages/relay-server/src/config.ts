import { PrivateKey } from "@libp2p/interface"
import { generateKeyPair, privateKeyFromProtobuf } from "@libp2p/crypto/keys"

const { LIBP2P_PRIVATE_KEY, LISTEN, ANNOUNCE, MIN_CONNECTIONS, MAX_CONNECTIONS } = process.env

export interface Config {
	privateKey: PrivateKey
	listen: string[]
	announce: string[]
	maxConnections: number
}

export async function getConfig(config: Partial<Config>): Promise<Config> {
	let privateKey = config.privateKey
	if (privateKey === undefined) {
		privateKey = await getPrivateKey()
	}

	let { maxConnections = 1024 } = config
	if (MAX_CONNECTIONS !== undefined) maxConnections = parseInt(MAX_CONNECTIONS)

	const listen = config.listen ?? LISTEN?.split(",") ?? []
	const announce = config.announce ?? ANNOUNCE?.split(",") ?? []

	return { privateKey, listen, announce, maxConnections }
}

async function getPrivateKey(): Promise<PrivateKey> {
	if (typeof LIBP2P_PRIVATE_KEY === "string") {
		return privateKeyFromProtobuf(Buffer.from(LIBP2P_PRIVATE_KEY, "base64"))
	} else {
		return await generateKeyPair("Ed25519")
	}
}
