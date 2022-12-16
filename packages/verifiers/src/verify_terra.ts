import type { Session } from "packages/interfaces/lib"
import { cosmosChainSettings } from "./verify_cosmos.js"
import { Secp256k1, Secp256k1Signature, Sha256 } from "@cosmjs/crypto"
import { pubkeyToAddress, decodeSignature } from "@cosmjs/amino"

export const verifyTerraSessionSignature = async (session: Session) => {
	// provided string should be serialized AminoSignResponse object
	const { signature: stdSignature } = JSON.parse(session.signature)

	// we generate an address from the actual public key and verify that it matches,
	// this prevents people from using a different key to sign the message than
	// the account they registered with.
	// TODO: ensure ion works
	const chain = cosmosChainSettings[session.payload.chainId]
	const bech32Prefix = chain.bech32_prefix
	if (!bech32Prefix) {
		console.error("No bech32 prefix found.")
		return ""
	}

	try {
		// directly verify the generated signature, generated via SignBytes
		const { pubkey, signature } = decodeSignature(stdSignature)
		const secpSignature = Secp256k1Signature.fromFixedLength(signature)
		const messageHash = new Sha256(Buffer.from(JSON.stringify(session.payload))).digest()

		if (await Secp256k1.verifySignature(secpSignature, messageHash, pubkey)) {
			// return the address generated from the signature
			return pubkeyToAddress(stdSignature.pub_key, bech32Prefix)
		}
	} catch (e) {
		console.log(e)
	}
	return ""
}
