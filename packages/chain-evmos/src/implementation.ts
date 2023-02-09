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
import { ethers } from "ethers"
import { configure as configureStableStringify } from "safe-stable-stringify"
import { decodeSignature, rawSecp256k1PubkeyToRawAddress, Secp256k1Wallet, serializeSignDoc } from "@cosmjs/amino"
import { Random, Secp256k1, Secp256k1Signature, Sha256 } from "@cosmjs/crypto"
import { toBech32 } from "@cosmjs/encoding"
import { EvmMetaMaskSigner } from "./signerInterface.js"
import { getActionSignatureData } from "./signatureData.js"

type Secp256k1WalletPrivateKey = Uint8Array

const sortedStringify = configureStableStringify({
	bigint: false,
	circularValue: Error,
	strict: true,
	deterministic: true,
})

const encodeEthAddress = (bech32Prefix: string, address: string) =>
	toBech32(bech32Prefix, ethers.utils.arrayify(address))

export class EvmosChainImplementation implements ChainImplementation<EvmMetaMaskSigner, Secp256k1WalletPrivateKey> {
	public readonly chain: Chain = "cosmos"

	constructor(public readonly chainId: ChainId = "osmosis-1", public readonly bech32Prefix: string = "osmo") {}

	async verifyAction(action: Action): Promise<void> {
		if (action.session) {
			// using delegated signer
			const signDocPayload = await getActionSignatureData(action.payload, action.session)
			const signDocDigest = new Sha256(serializeSignDoc(signDocPayload)).digest()

			const { pubkey, signature: decodedSignature } = decodeSignature(JSON.parse(action.signature))
			const addressFromPubKey = toBech32(this.bech32Prefix, rawSecp256k1PubkeyToRawAddress(pubkey))
			if (action.session !== addressFromPubKey) {
				// Delegated signatures: If session exists, pubkey should be the public key for `action.session`
				throw new Error("Action signed with a pubkey that doesn't match the session address")
			}
			const secpSignature = Secp256k1Signature.fromFixedLength(decodedSignature)
			const valid = await Secp256k1.verifySignature(secpSignature, signDocDigest, pubkey)
			if (!valid) {
				throw new Error("Invalid session signature")
			}
		} else {
			// using direct signer
			// get address from pubkey
			const msgBuffer = Buffer.from(sortedStringify(action.payload))
			const msgHash = ethers.utils.hashMessage(msgBuffer)
			const publicKey = ethers.utils.recoverPublicKey(msgHash, action.signature.trim())
			const lowercaseEthAddress = ethers.utils.computeAddress(publicKey).toLowerCase()

			// convert to cosmos address
			const addressFromPubKey = encodeEthAddress(this.bech32Prefix, lowercaseEthAddress)
			if (action.payload.from !== addressFromPubKey) {
				// Direct signatures: If session is null, pubkey should be the public key for `action.payload.from`
				throw new Error("Action signed with a pubkey that doesn't match the from address")
			}
		}
	}

	async verifySession(session: Session): Promise<void> {
		//
		// ethereum address handling on cosmos chains via metamask
		//

		const msgBuffer = Buffer.from(sortedStringify(session.payload))

		// toBuffer() doesn't work if there is a newline
		const msgHash = ethers.utils.hashMessage(msgBuffer)
		const publicKey = ethers.utils.recoverPublicKey(msgHash, session.signature.trim())
		const address = ethers.utils.computeAddress(publicKey)
		const lowercaseAddress = address.toLowerCase()

		let isValid
		try {
			if (session.payload.from === encodeEthAddress(this.bech32Prefix, lowercaseAddress)) isValid = true
		} catch (e) {
			isValid = false
		}

		if (!isValid) {
			throw new Error("Invalid session signature")
		}
	}

	getSignerAddress = async (signer: EvmMetaMaskSigner): Promise<string> => {
		const accounts = await signer.eth.getAccounts()
		const address = accounts[0]
		// convert to cosmos address
		return toBech32(this.bech32Prefix, ethers.utils.arrayify(address))
	}
	// encodeEthAddress(app.chain?.meta.bech32Prefix || 'inj', acc)
	getDelegatedSignerAddress = async (privkey: Secp256k1WalletPrivateKey) => {
		const wallet = await Secp256k1Wallet.fromKey(privkey)
		return (await wallet.getAccounts())[0].address
	}

	isSigner(signer: unknown): signer is EvmMetaMaskSigner {
		throw Error("Not implemented!")
	}

	isDelegatedSigner(delegatedSigner: unknown): delegatedSigner is Secp256k1WalletPrivateKey {
		// copy from cosmos
		throw Error("Not implemented!")
	}

	async signSession(signer: EvmMetaMaskSigner, payload: SessionPayload): Promise<Session> {
		const address = await this.getSignerAddress(signer)
		const dataToSign = serializeSessionPayload(payload)
		const signature = await signer.eth.personal.sign(dataToSign, address, "")
		return {
			payload,
			signature,
			type: "session",
		}
	}

	async signAction(signer: EvmMetaMaskSigner, payload: ActionPayload): Promise<Action> {
		const address = await this.getSignerAddress(signer)
		const dataToSign = serializeActionPayload(payload)
		const signature = await signer.eth.personal.sign(dataToSign, address, "")
		return {
			payload,
			signature,
			type: "action",
			session: null,
		}
	}

	async signDelegatedAction(privkey: Secp256k1WalletPrivateKey, payload: ActionPayload): Promise<Action> {
		throw Error("Not implemented!")
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
		throw Error("Not implemented!")
	}
}
