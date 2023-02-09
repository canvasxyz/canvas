import {
	Action,
	ActionPayload,
	Chain,
	ChainId,
	ChainImplementation,
	serializeSessionPayload,
	Session,
	SessionPayload,
} from "@canvas-js/interfaces"
import { ethers } from "ethers"
import { configure as configureStableStringify } from "safe-stable-stringify"
import { Secp256k1Wallet } from "@cosmjs/amino"
import { Random } from "@cosmjs/crypto"
import { toBech32 } from "@cosmjs/encoding"
import { EvmMetaMaskSigner } from "./signerInterface.js"

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
		// const actionSignerAddress = action.session ?? action.payload.from
		// const signDocPayload = await getActionSignatureData(action.payload, actionSignerAddress)
		// const signDocDigest = new Sha256(serializeSignDoc(signDocPayload)).digest()
		// const prefix = "cosmos" // not: fromBech32(payload.from).prefix;

		// const { pubkey, signature: decodedSignature } = decodeSignature(JSON.parse(action.signature))
		// if (action.session && action.session !== toBech32(prefix, rawSecp256k1PubkeyToRawAddress(pubkey))) {
		// 	// Delegated signatures: If session exists, pubkey should be the public key for `action.session`
		// 	throw new Error("Action signed with a pubkey that doesn't match the session address")
		// }
		// if (!action.session && action.payload.from !== toBech32(prefix, rawSecp256k1PubkeyToRawAddress(pubkey))) {
		// 	// Direct signatures: If session is null, pubkey should be the public key for `action.payload.from`
		// 	throw new Error("Action signed with a pubkey that doesn't match the from address")
		// }
		// const secpSignature = Secp256k1Signature.fromFixedLength(decodedSignature)
		// const valid = await Secp256k1.verifySignature(secpSignature, signDocDigest, pubkey)

		// if (!valid) {
		// 	throw new Error("Invalid session signature")
		// }
		throw Error("Not implemented!")
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
		throw Error("Not implemented!")
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
