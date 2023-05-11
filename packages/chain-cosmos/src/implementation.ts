import type { OfflineAminoSigner } from "@keplr-wallet/types"
import { Secp256k1Wallet, serializeSignDoc, decodeSignature, rawSecp256k1PubkeyToRawAddress } from "@cosmjs/amino"
import { Secp256k1, Secp256k1Signature, ExtendedSecp256k1Signature, Random, Sha256 } from "@cosmjs/crypto"
import { fromBech32, toBech32 } from "@cosmjs/encoding"
import { ethers } from "ethers"
import { FixedExtension as TerraFixedExtension } from "@terra-money/wallet-controller/modules/legacy-extension"
import {
	Action,
	ActionPayload,
	ChainImplementation,
	serializeActionPayload,
	Session,
	SessionPayload,
} from "@canvas-js/interfaces"
import { serializeSessionPayload } from "@canvas-js/interfaces"

import { getActionSignatureData, getSessionSignatureData } from "./signatureData.js"
import { EvmMetaMaskSigner, KeplrEthereumSigner } from "./signerInterface.js"
import { configure as configureStableStringify } from "safe-stable-stringify"

type Secp256k1WalletPrivateKey = Uint8Array

type CosmosSigner = EvmMetaMaskSigner | KeplrEthereumSigner | OfflineAminoSigner | TerraFixedExtension

const sortedStringify = configureStableStringify({
	bigint: false,
	circularValue: Error,
	strict: true,
	deterministic: true,
})

const encodeEthAddress = (bech32Prefix: string, address: string) =>
	toBech32(bech32Prefix, ethers.utils.arrayify(address))

function isEvmMetaMaskSigner(signer: unknown): signer is EvmMetaMaskSigner {
	return (
		!!signer &&
		typeof signer === "object" &&
		"eth" in signer &&
		!!signer.eth &&
		typeof signer.eth === "object" &&
		"personal" in signer.eth &&
		typeof signer.eth.personal === "object" &&
		"getAccounts" in signer.eth &&
		typeof signer.eth.getAccounts === "function"
	)
}

function isKeplrEthereumSigner(signer: unknown): signer is KeplrEthereumSigner {
	return (
		!!signer &&
		typeof signer === "object" &&
		"signEthereum" in signer &&
		typeof signer.signEthereum === "function" &&
		"getOfflineSigner" in signer &&
		typeof signer.getOfflineSigner === "function"
	)
}

function isOfflineAminoSigner(signer: unknown): signer is OfflineAminoSigner {
	return (
		!!signer &&
		typeof signer === "object" &&
		"getAccounts" in signer &&
		typeof signer.getAccounts === "function" &&
		"signAmino" in signer &&
		typeof signer.signAmino === "function"
	)
}

function isTerraFixedExtension(signer: unknown): signer is TerraFixedExtension {
	if (!(!!signer && typeof signer === "object")) {
		return false
	}

	const functions = ["post", "sign", "signBytes", "info", "connect", "inTransactionProgress", "disconnect"]
	for (const funcName of functions) {
		// const fn = signer[funcName]
		if (!(funcName in signer && typeof (signer as any)[funcName] === "function")) {
			return false
		}
	}
	return true
}

const chainIdPattern = /^[-a-zA-Z0-9_]{1,32}$/

/**
 * Cosmos chain export.
 */
export class CosmosChainImplementation implements ChainImplementation<CosmosSigner, Secp256k1WalletPrivateKey> {
	public readonly chain: string
	constructor(public readonly chainId = "cosmoshub-1", public readonly bech32Prefix = "cosmos") {
		// https://github.com/ChainAgnostic/namespaces/blob/main/cosmos/caip-2.md
		if (chainIdPattern.test(chainId)) {
			this.chain = `cosmos:${chainId}`
		} else {
			// TODO: implement `hashed-` reference generation
			throw new Error("Unsupported chainId")
		}
	}

	hasProvider() {
		return false
	}

	private async verifyDelegatedAction(payload: ActionPayload, signature: string, session: string): Promise<boolean> {
		const signDocPayload = await getActionSignatureData(payload, session)
		const signDocDigest = new Sha256(serializeSignDoc(signDocPayload)).digest()

		const prefix = "cosmos" // not: fromBech32(payload.from).prefix;
		const extendedSignature = ExtendedSecp256k1Signature.fromFixedLength(Buffer.from(signature, "hex"))
		const pubkey = Secp256k1.compressPubkey(Secp256k1.recoverPubkey(extendedSignature, signDocDigest))

		return session === toBech32(prefix, rawSecp256k1PubkeyToRawAddress(pubkey))
	}

	private async verifyDirectAction(payload: ActionPayload, signature: string): Promise<boolean> {
		let isValid = false
		if (signature.slice(0, 2) === "0x") {
			// eth
			const message = Buffer.from(sortedStringify(payload))
			isValid = await this.verifyEthSign(message, signature, payload.from)
		} else {
			// cosmos signed
			const { pubkey, signature: decodedSignature } = decodeSignature(JSON.parse(signature))
			// direct
			if (payload.from !== toBech32(this.bech32Prefix, rawSecp256k1PubkeyToRawAddress(pubkey))) {
				// Direct signatures: If session is null, pubkey should be the public key for `action.payload.from`
				throw new Error("Action signed with a pubkey that doesn't match the from address")
			}

			const signDocPayload = await getActionSignatureData(payload, payload.from)
			const signDocDigest = new Sha256(serializeSignDoc(signDocPayload)).digest()

			const serializedPayload = Buffer.from(serializeActionPayload(payload))
			const digest = new Sha256(serializedPayload).digest()

			// compare the signature against the directly signed and signdoc digests
			const secpSignature = Secp256k1Signature.fromFixedLength(decodedSignature)
			isValid ||= await Secp256k1.verifySignature(secpSignature, signDocDigest, pubkey)
			isValid ||= await Secp256k1.verifySignature(secpSignature, digest, pubkey)
		}

		return isValid
	}

	async verifyAction(action: Action): Promise<void> {
		const isValid = action.session
			? await this.verifyDelegatedAction(action.payload, action.signature, action.session)
			: await this.verifyDirectAction(action.payload, action.signature)

		if (!isValid) {
			throw new Error("Invalid action signature")
		}
	}

	private async verifyEthSign(message: Buffer, signature: string, from: string): Promise<boolean> {
		// keplr-ethereum

		// toBuffer() doesn't work if there is a newline
		const msgHash = ethers.utils.hashMessage(message)
		const publicKey = ethers.utils.recoverPublicKey(msgHash, signature.trim())
		const address = ethers.utils.computeAddress(publicKey)
		const lowercaseAddress = address.toLowerCase()

		try {
			const { prefix } = fromBech32(from)
			return from === encodeEthAddress(prefix, lowercaseAddress)
		} catch (e) {
			return false
		}
	}

	private async verifyCosmosSession(session: Session): Promise<boolean> {
		// decode "{ pub_key, signature }" to an object with { pubkey, signature }
		const { pubkey, signature: decodedSignature } = decodeSignature(JSON.parse(session.signature))

		const { prefix } = fromBech32(session.payload.from)
		if (session.payload.from !== toBech32(prefix, rawSecp256k1PubkeyToRawAddress(pubkey))) {
			throw new Error("Session signed with a pubkey that doesn't match the session address")
		}

		// the payload can either be signed directly, or encapsulated in a SignDoc
		const signDocPayload = await getSessionSignatureData(session.payload, session.payload.from)
		const signDocDigest = new Sha256(serializeSignDoc(signDocPayload)).digest()
		const serializedPayload = Buffer.from(serializeSessionPayload(session.payload))
		const digest = new Sha256(serializedPayload).digest()

		// compare the signature against the directly signed and signdoc digests
		const secpSignature = Secp256k1Signature.fromFixedLength(decodedSignature)
		let isValid = false
		isValid ||= await Secp256k1.verifySignature(secpSignature, signDocDigest, pubkey)
		isValid ||= await Secp256k1.verifySignature(secpSignature, digest, pubkey)
		return isValid
	}

	async verifySession(session: Session): Promise<void> {
		const { signature } = session

		let isValid = false
		if (signature.slice(0, 2) === "0x") {
			const message = Buffer.from(sortedStringify(session.payload))
			isValid = await this.verifyEthSign(message, session.signature, session.payload.from)
		} else {
			isValid = await this.verifyCosmosSession(session)
		}

		if (!isValid) {
			throw new Error("Invalid session signature")
		}
	}

	getSignerAddress = async (signer: CosmosSigner) => {
		if (isEvmMetaMaskSigner(signer)) {
			const accounts = await signer.eth.getAccounts()
			const address = accounts[0]
			return toBech32(this.bech32Prefix, ethers.utils.arrayify(address))
		} else if (isKeplrEthereumSigner(signer)) {
			const accounts = await signer.getOfflineSigner(this.chainId).getAccounts()
			const address = accounts[0].address
			// convert to cosmos address
			return toBech32(this.bech32Prefix, ethers.utils.arrayify(address))
		} else if (isOfflineAminoSigner(signer)) {
			return (await signer.getAccounts())[0].address
		} else if (isTerraFixedExtension(signer)) {
			return (await signer.connect()).address!
		} else {
			throw Error(`getSignerAddress called with invalid signer object!`)
		}
	}
	getDelegatedSignerAddress = async (privkey: Secp256k1WalletPrivateKey) => {
		const wallet = await Secp256k1Wallet.fromKey(privkey)
		return (await wallet.getAccounts())[0].address
	}

	async signSession(signer: CosmosSigner, payload: SessionPayload): Promise<Session> {
		let signature: string
		const address = await this.getSignerAddress(signer)
		if (isEvmMetaMaskSigner(signer)) {
			const dataToSign = serializeSessionPayload(payload)
			signature = await signer.eth.personal.sign(dataToSign, address, "")
		} else if (isKeplrEthereumSigner(signer)) {
			const dataToSign = serializeSessionPayload(payload)
			const rawSignature = await signer.signEthereum(this.chainId, address, dataToSign, "message")
			signature = `0x${Buffer.from(rawSignature).toString("hex")}`
		} else if (isOfflineAminoSigner(signer)) {
			const signDoc = await getSessionSignatureData(payload, address)
			signature = JSON.stringify((await signer.signAmino(address, signDoc)).signature)
		} else if (isTerraFixedExtension(signer)) {
			const result = await signer.signBytes(Buffer.from(serializeSessionPayload(payload)))

			signature = JSON.stringify({
				pub_key: {
					type: "tendermint/PubKeySecp256k1",
					value: result.payload.result.public_key,
				},
				signature: result.payload.result.signature,
			})
		} else {
			throw Error(`signSession called with invalid signer object!`)
		}
		return { type: "session", signature, payload }
	}

	async signAction(signer: CosmosSigner, payload: ActionPayload): Promise<Action> {
		const address = await this.getSignerAddress(signer)
		if (address !== payload.from) {
			throw new Error("Direct signAction called with address that doesn't match action.payload.from")
		}

		let signature: string | undefined = undefined
		if (isEvmMetaMaskSigner(signer)) {
			const dataToSign = serializeActionPayload(payload)
			signature = await signer.eth.personal.sign(dataToSign, address, "")
		} else if (isKeplrEthereumSigner(signer)) {
			const dataToSign = serializeActionPayload(payload)
			const rawSignature = await signer.signEthereum(this.chainId, address, dataToSign, "message")
			signature = `0x${Buffer.from(rawSignature).toString("hex")}`
		} else if (isOfflineAminoSigner(signer)) {
			const signDoc = await getActionSignatureData(payload, address)
			signature = JSON.stringify((await signer.signAmino(address, signDoc)).signature)
		} else if (isTerraFixedExtension(signer)) {
			const result = await signer.signBytes(Buffer.from(serializeActionPayload(payload)))
			signature = JSON.stringify({
				pub_key: {
					type: "tendermint/PubKeySecp256k1",
					value: result.payload.result.public_key,
				},
				signature: result.payload.result.signature,
			})
		} else {
			throw Error(`signAction called with invalid signer object!`)
		}

		return { type: "action", payload, signature, session: null }
	}

	async signDelegatedAction(privkey: Secp256k1WalletPrivateKey, payload: ActionPayload) {
		const signer = await Secp256k1Wallet.fromKey(privkey)
		const accountData = (await signer.getAccounts())[0]
		const signDoc = await getActionSignatureData(payload, accountData.address)

		const signDocDigest = new Sha256(serializeSignDoc(signDoc)).digest()
		const extendedSignature = await Secp256k1.createSignature(signDocDigest, privkey)
		const signature = Buffer.from(extendedSignature.toFixedLength()).toString("hex")

		const action: Action = {
			type: "action",
			payload,
			session: accountData.address,
			signature,
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
