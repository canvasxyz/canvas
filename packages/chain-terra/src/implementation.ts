import { Secp256k1Wallet, serializeSignDoc, decodeSignature, rawSecp256k1PubkeyToRawAddress } from "@cosmjs/amino"
import { Secp256k1, Secp256k1Signature, Random, Sha256 } from "@cosmjs/crypto"
import { fromBech32, toBase64, toBech32 } from "@cosmjs/encoding"
import { FixedExtension } from "@terra-money/wallet-controller/modules/legacy-extension"

import {
	Action,
	ActionPayload,
	Chain,
	ChainId,
	ChainImplementation,
	serializeActionPayload,
	serializeSessionPayload,
	Session,
	SessionPayload,
} from "@canvas-js/interfaces"

import { getActionSignatureData } from "./signatureData.js"

type Secp256k1WalletPrivateKey = Uint8Array

/**
 * Terra chain export.
 */
export class TerraChainImplementation implements ChainImplementation<FixedExtension, Secp256k1WalletPrivateKey> {
	public readonly chain: Chain = "cosmos"

	constructor(public readonly chainId: ChainId = "phoenix-1") {}

	async verifyAction(action: Action): Promise<void> {
		const prefix = "cosmos" // not: fromBech32(payload.from).prefix;

		const { pubkey, signature: decodedSignature } = decodeSignature(JSON.parse(action.signature))

		if (action.session && action.session !== toBech32(prefix, rawSecp256k1PubkeyToRawAddress(pubkey))) {
			// Delegated signatures: If session exists, pubkey should be the public key for `action.session`
			throw new Error("Action signed with a pubkey that doesn't match the session address")
		}
		if (!action.session && action.payload.from !== toBech32(prefix, rawSecp256k1PubkeyToRawAddress(pubkey))) {
			// Direct signatures: If session is null, pubkey should be the public key for `action.payload.from`
			throw new Error("Action signed with a pubkey that doesn't match the from address")
		}
		// delegated signer signs using signdoc, direct signer signs payload directly
		const serializedPayload: Uint8Array = action.session
			? serializeSignDoc(await getActionSignatureData(action.payload, action.session))
			: Buffer.from(serializeActionPayload(action.payload))

		const signDocDigest = new Sha256(serializedPayload).digest()
		const secpSignature = Secp256k1Signature.fromFixedLength(decodedSignature)
		const valid = await Secp256k1.verifySignature(secpSignature, signDocDigest, pubkey)

		if (!valid) {
			throw new Error("Invalid session signature")
		}
	}

	async verifySession(session: Session): Promise<void> {
		// Terra implementation
		// This doesn't make a SignDoc
		const signDocPayload = Buffer.from(serializeSessionPayload(session.payload))
		const signDocDigest = new Sha256(signDocPayload).digest()
		const { prefix } = fromBech32(session.payload.from)

		// decode "{ pub_key, signature }" to an object with { pubkey, signature }
		const { pubkey, signature: decodedSignature } = decodeSignature(JSON.parse(session.signature))
		if (session.payload.from !== toBech32(prefix, rawSecp256k1PubkeyToRawAddress(pubkey))) {
			throw new Error("Session signed with a pubkey that doesn't match the session address")
		}

		const secpSignature = Secp256k1Signature.fromFixedLength(decodedSignature)
		const valid = await Secp256k1.verifySignature(secpSignature, signDocDigest, pubkey)
		if (!valid) {
			throw new Error("Invalid session signature")
		}
	}

	getSignerAddress = async (signer: FixedExtension) => {
		return (await signer.connect()).address!
	}
	getDelegatedSignerAddress = async (privkey: Secp256k1WalletPrivateKey) => {
		const wallet = await Secp256k1Wallet.fromKey(privkey)
		return (await wallet.getAccounts())[0].address
	}

	isSigner(signer: unknown): signer is FixedExtension {
		return !(signer instanceof ArrayBuffer)
	}

	isDelegatedSigner(delegatedSigner: unknown): delegatedSigner is Secp256k1WalletPrivateKey {
		return delegatedSigner instanceof ArrayBuffer
	}

	async signSession(signer: FixedExtension, payload: SessionPayload): Promise<Session> {
		const result = await signer.signBytes(Buffer.from(serializeSessionPayload(payload)))

		const signature = JSON.stringify({
			pub_key: {
				type: "tendermint/PubKeySecp256k1",
				value: result.payload.result.public_key,
			},
			signature: result.payload.result.signature,
		})

		return { type: "session", signature, payload }
	}

	async signAction(signer: FixedExtension, payload: ActionPayload): Promise<Action> {
		const address = (await signer.connect()).address!
		if (address !== payload.from) {
			throw new Error("Direct signAction called with address that doesn't match action.payload.from")
		}

		const result = await signer.signBytes(Buffer.from(serializeActionPayload(payload)))

		const signature = JSON.stringify({
			pub_key: {
				type: "tendermint/PubKeySecp256k1",
				value: result.payload.result.public_key,
			},
			signature: result.payload.result.signature,
		})

		return { type: "action", payload, session: null, signature }
	}

	async signDelegatedAction(privkey: Secp256k1WalletPrivateKey, payload: ActionPayload) {
		const signer = await Secp256k1Wallet.fromKey(privkey)
		const accountData = (await signer.getAccounts())[0]
		const signDoc = await getActionSignatureData(payload, accountData.address)

		const {
			signature: { pub_key, signature },
		} = await signer.signAmino(accountData.address, signDoc)
		const action: Action = {
			type: "action",
			payload,
			session: accountData.address,
			signature: JSON.stringify({ pub_key, signature }),
		}
		return action
	}

	importDelegatedSigner = (privkeyString: string) => Buffer.from(privkeyString, "hex")
	exportDelegatedSigner = (privkey: Secp256k1WalletPrivateKey) => Buffer.from(privkey).toString("hex")
	generateDelegatedSigner = async (): Promise<Secp256k1WalletPrivateKey> => {
		// same entropy for generating private keys as @cosmjs/amino Secp256k1HdWallet
		const entropyLength = 4 * Math.floor((11 * 24) / 33)
		const privkeyBytes = Random.getBytes(entropyLength)
		return privkeyBytes
	}

	async getLatestBlock(): Promise<string> {
		throw new Error("Unimplemented")
	}
}
