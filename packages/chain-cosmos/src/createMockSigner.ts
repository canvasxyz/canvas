import { Secp256k1Wallet } from "@cosmjs/amino"
import { Random } from "@cosmjs/crypto"

export async function createMockCosmosSigner() {
	const entropyLength = 4 * Math.floor((11 * 24) / 33)
	const privkeyBytes = Random.getBytes(entropyLength)
	const wallet = await Secp256k1Wallet.fromKey(privkeyBytes)
	return wallet
}
