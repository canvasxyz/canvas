import type { Action, Session } from "@canvas-js/interfaces"

import { Secp256k1, Secp256k1Signature, Sha256 } from "@cosmjs/crypto"
import { pubkeyToAddress, serializeSignDoc, decodeSignature } from "@cosmjs/amino"

// Cosmos cannot sign arbitrary blobs, but they can sign transactions. So, as a hack around that,
// we insert our account registration token into a proposal message, and then verify against the
// generated signature. But first we need the message to insert.
import { AminoMsg, makeSignDoc, StdSignDoc, StdFee } from "@cosmjs/amino"
import { toBase64 } from "@cosmjs/encoding"

export const validationTokenToSignDoc = (token: Uint8Array, address: string): StdSignDoc => {
	const accountNumber = 0
	const sequence = 0
	const chainId = ""
	const fee: StdFee = {
		gas: "0",
		amount: [],
	}
	const memo = ""

	const jsonTx: AminoMsg = {
		type: "sign/MsgSignData",
		value: {
			signer: address,
			data: toBase64(token),
		},
	}
	const signDoc = makeSignDoc([jsonTx], fee, chainId, memo, accountNumber, sequence)
	return signDoc
}

type ChainSettings = {
	bech32_prefix: string
}

const cosmosChainSettings = {
	"osmosis-1": {
		bech32_prefix: "osmo",
	},
	"evmos_9001-2": {
		bech32_prefix: "evmos",
	},
} as { [key: string]: ChainSettings }

export const verifyCosmosActionSignature = async (action: Action): Promise<string> => {
	const stdSignature = JSON.parse(action.signature)

	const chain = cosmosChainSettings[action.payload.chainId]

	const bech32Prefix = chain.bech32_prefix
	if (!bech32Prefix) {
		console.error("No bech32 prefix found.")
		return ""
	}

	const generatedAddressWithCosmosPrefix = pubkeyToAddress(stdSignature.pub_key, "cosmos")

	if (generatedAddressWithCosmosPrefix !== action.session) {
		console.error(`Address not matched. Generated ${generatedAddressWithCosmosPrefix}, found ${action.session}.`)
		return ""
	}

	let isValid: boolean
	try {
		// Generate sign doc from token and verify it against the signature
		const generatedSignDoc = validationTokenToSignDoc(
			Buffer.from(JSON.stringify(action.payload)),
			generatedAddressWithCosmosPrefix
		)

		const { pubkey, signature } = decodeSignature(stdSignature)
		const secpSignature = Secp256k1Signature.fromFixedLength(signature)
		const messageHash = new Sha256(serializeSignDoc(generatedSignDoc)).digest()
		isValid = await Secp256k1.verifySignature(secpSignature, messageHash, pubkey)
		if (!isValid) {
			console.error("Signature mismatch.")
		}
	} catch (e) {
		console.error(`Signature verification failed: ${(e as any).message}`)
		isValid = false
	}

	if (isValid) {
		return generatedAddressWithCosmosPrefix
	} else {
		return ""
	}
}

export const verifyCosmosSessionSignature = async (session: Session): Promise<string> => {
	const stdSignature = JSON.parse(session.signature)

	const chain = cosmosChainSettings[session.payload.chainId]

	const bech32Prefix = chain.bech32_prefix
	if (!bech32Prefix) {
		console.error("No bech32 prefix found.")
		return ""
	}

	const generatedAddress = pubkeyToAddress(stdSignature.pub_key, bech32Prefix)
	const generatedAddressWithCosmosPrefix = pubkeyToAddress(stdSignature.pub_key, "cosmos")

	if (generatedAddress !== session.payload.from && generatedAddressWithCosmosPrefix !== session.payload.from) {
		console.error(`Address not matched. Generated ${generatedAddress}, found ${session.payload.from}.`)
		return ""
	}

	let isValid: boolean
	try {
		// Generate sign doc from token and verify it against the signature
		const generatedSignDoc = validationTokenToSignDoc(Buffer.from(JSON.stringify(session.payload)), generatedAddress)

		const { pubkey, signature } = decodeSignature(stdSignature)
		const secpSignature = Secp256k1Signature.fromFixedLength(signature)
		const messageHash = new Sha256(serializeSignDoc(generatedSignDoc)).digest()
		isValid = await Secp256k1.verifySignature(secpSignature, messageHash, pubkey)
		if (!isValid) {
			console.error("Signature mismatch.")
		}
	} catch (e) {
		console.error(`Signature verification failed: ${(e as any).message}`)
		isValid = false
	}

	if (isValid) {
		return generatedAddress
	} else {
		return ""
	}
}
