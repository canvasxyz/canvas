import { PrivateKey } from "@libp2p/interface"
import { generateKeyPair, privateKeyFromProtobuf } from "@libp2p/crypto/keys"

export async function getPrivateKey(): Promise<PrivateKey> {
	// TODO: persist keys to localstorage
	return await generateKeyPair("Ed25519")

	// const { LIBP2P_PRIVATE_KEY } = process.env
	// if (typeof LIBP2P_PRIVATE_KEY === "string") {
	// 	return privateKeyFromProtobuf(Buffer.from(LIBP2P_PRIVATE_KEY, "base64"))
	// } else {
	// }
}
