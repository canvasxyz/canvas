import type { OfflineAminoSigner } from "@keplr-wallet/types"
import { Secp256k1Wallet, serializeSignDoc, decodeSignature, rawSecp256k1PubkeyToRawAddress } from "@cosmjs/amino"
import { Secp256k1, Secp256k1Signature, Random, Sha256, ExtendedSecp256k1Signature } from "@cosmjs/crypto"
import { fromBech32, toBech32 } from "@cosmjs/encoding"

import type {
	Action,
	ActionPayload,
	Chain,
	ChainId,
	ChainImplementation,
	Session,
	SessionPayload,
} from "@canvas-js/interfaces"

import { getActionSignatureData, getSessionSignatureData } from "./signatureData.js"

type Secp256k1WalletPrivateKey = Uint8Array

/**
 * Cosmos chain export.
 */
export class CosmosChainImplementation implements ChainImplementation<OfflineAminoSigner, Secp256k1WalletPrivateKey> {
	public readonly chain: Chain = "cosmos"

	constructor(public readonly chainId: ChainId = "mainnet") {}

	async verifyAction(action: Action): Promise<void> {
		const actionSignerAddress = action.session ?? action.payload.from
		const signDocPayload = await getActionSignatureData(action.payload, actionSignerAddress)
		const signDocDigest = new Sha256(serializeSignDoc(signDocPayload)).digest()
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
		const secpSignature = Secp256k1Signature.fromFixedLength(decodedSignature)
		const valid = await Secp256k1.verifySignature(secpSignature, signDocDigest, pubkey)

		if (!valid) {
			throw new Error("Invalid session signature")
		}
	}

	async verifySession(session: Session): Promise<void> {
		const signDocPayload = await getSessionSignatureData(session.payload, session.payload.from) // TODO
		const signDocDigest = new Sha256(serializeSignDoc(signDocPayload)).digest()
		const { prefix } = fromBech32(session.payload.from)

		// decode "{ pub_key, signature }" to an object with { pubkey, signature } using the amino helper
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

	getSignerAddress = async (signer: OfflineAminoSigner) => {
		return (await signer.getAccounts())[0].address
	}
	getDelegatedSignerAddress = async (privkey: Secp256k1WalletPrivateKey) => {
		const wallet = await Secp256k1Wallet.fromKey(privkey)
		return (await wallet.getAccounts())[0].address
	}

	isSigner(signer: unknown): signer is OfflineAminoSigner {
		return !(signer instanceof ArrayBuffer)
	}

	isDelegatedSigner(delegatedSigner: unknown): delegatedSigner is Secp256k1WalletPrivateKey {
		return delegatedSigner instanceof ArrayBuffer
	}

	async signSession(signer: OfflineAminoSigner, payload: SessionPayload): Promise<Session> {
		const address = (await signer.getAccounts())[0].address
		const signDoc = await getSessionSignatureData(payload, address)
		const {
			signature: { pub_key, signature },
		} = await signer.signAmino(address, signDoc)
		const session: Session = { type: "session", signature: JSON.stringify({ pub_key, signature }), payload }
		return session
	}

	async signAction(signer: OfflineAminoSigner, payload: ActionPayload): Promise<Action> {
		const address = (await signer.getAccounts())[0].address
		const signDoc = await getActionSignatureData(payload, address)
		if (address !== payload.from) {
			throw new Error("Direct signAction called with address that doesn't match action.payload.from")
		}
		const {
			signature: { pub_key, signature },
		} = await signer.signAmino(address, signDoc)
		const action: Action = { type: "action", payload, session: null, signature: JSON.stringify({ pub_key, signature }) }
		return action
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
