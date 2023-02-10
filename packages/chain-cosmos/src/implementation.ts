import type { Keplr, OfflineAminoSigner } from "@keplr-wallet/types"
import { Secp256k1Wallet, serializeSignDoc, decodeSignature, rawSecp256k1PubkeyToRawAddress } from "@cosmjs/amino"
import { Secp256k1, Secp256k1Signature, Random, Sha256 } from "@cosmjs/crypto"
import { fromBech32, toBech32 } from "@cosmjs/encoding"
import { ethers } from "ethers"
import { FixedExtension } from "@terra-money/wallet-controller/modules/legacy-extension"
import {
	Action,
	ActionPayload,
	Chain,
	ChainId,
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

type CosmosSigner = EvmMetaMaskSigner | KeplrEthereumSigner | OfflineAminoSigner | FixedExtension

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
		typeof signer == "object" &&
		"eth" in signer &&
		!!signer.eth &&
		typeof signer.eth == "object" &&
		"personal" in signer.eth &&
		typeof signer.eth.personal == "object" &&
		"getAccounts" in signer.eth &&
		typeof signer.eth.getAccounts == "function"
	)
}

function isKeplrEthereumSigner(signer: unknown): signer is KeplrEthereumSigner {
	return (
		!!signer &&
		typeof signer == "object" &&
		"signEthereum" in signer &&
		typeof signer.signEthereum == "function" &&
		"getOfflineSigner" in signer &&
		typeof signer.getOfflineSigner == "function"
	)
}

function isOfflineAminoSigner(signer: unknown): signer is OfflineAminoSigner {
	return (
		!!signer &&
		typeof signer == "object" &&
		"getAccounts" in signer &&
		typeof signer.getAccounts == "function" &&
		"signAmino" in signer &&
		typeof signer.signAmino == "function"
	)
}

function isFixedExtension(signer: unknown): signer is FixedExtension {
	if (!(!!signer && typeof signer == "object")) {
		return false
	}

	const functions = ["post", "sign", "signBytes", "info", "connect", "inTransactionProgress", "disconnect"]
	for (const funcName of functions) {
		// @ts-ignore
		if (!(funcName in signer && typeof signer[funcName] == "function")) {
			return false
		}
	}
	return true
}

/**
 * Cosmos chain export.
 */
export class CosmosChainImplementation implements ChainImplementation<CosmosSigner, Secp256k1WalletPrivateKey> {
	public readonly chain: Chain = "cosmos"

	constructor(public readonly chainId: ChainId = "mainnet", public readonly bech32Prefix: string = "osmo") {}

	private async verifyDelegatedAction(action: Action, session: string): Promise<boolean> {
		const signDocPayload = await getActionSignatureData(action.payload, session)
		const signDocDigest = new Sha256(serializeSignDoc(signDocPayload)).digest()

		const prefix = "cosmos" // not: fromBech32(payload.from).prefix;
		const { pubkey, signature: decodedSignature } = decodeSignature(JSON.parse(action.signature))

		if (action.session !== toBech32(prefix, rawSecp256k1PubkeyToRawAddress(pubkey))) {
			// Delegated signatures: If session exists, pubkey should be the public key for `action.session`
			throw new Error("Action signed with a pubkey that doesn't match the session address")
		}

		const secpSignature = Secp256k1Signature.fromFixedLength(decodedSignature)
		return await Secp256k1.verifySignature(secpSignature, signDocDigest, pubkey)
	}

	private async verifyDirectAction(action: Action): Promise<boolean> {
		const prefix = "cosmos" // not: fromBech32(payload.from).prefix;
		let isValid: boolean
		if (action.signature.slice(0, 2) == "0x") {
			// eth
			const message = Buffer.from(sortedStringify(action.payload))
			isValid = await this.verifyEthSign(message, action.signature, action.payload.from)
		} else {
			// cosmos signed
			const { pubkey, signature: decodedSignature } = decodeSignature(JSON.parse(action.signature))
			// direct
			if (action.payload.from !== toBech32(prefix, rawSecp256k1PubkeyToRawAddress(pubkey))) {
				// Direct signatures: If session is null, pubkey should be the public key for `action.payload.from`
				throw new Error("Action signed with a pubkey that doesn't match the from address")
			}

			const signDocPayload = await getActionSignatureData(action.payload, action.payload.from)
			const signDocDigest = new Sha256(serializeSignDoc(signDocPayload)).digest()

			const serializedPayload = Buffer.from(serializeActionPayload(action.payload))
			const digest = new Sha256(serializedPayload).digest()
			// compare the signature against the directly signed and signdoc digests
			const secpSignature = Secp256k1Signature.fromFixedLength(decodedSignature)
			isValid =
				(await Secp256k1.verifySignature(secpSignature, signDocDigest, pubkey)) ||
				(await Secp256k1.verifySignature(secpSignature, digest, pubkey))
		}
		return isValid
	}

	async verifyAction(action: Action): Promise<void> {
		const isValid = action.session
			? await this.verifyDelegatedAction(action, action.session)
			: await this.verifyDirectAction(action)

		if (!isValid) {
			throw new Error("Invalid session signature")
		}
	}

	private async verifyEthSign(message: Buffer, signature: string, from: string): Promise<boolean> {
		// keplr-ethereum

		// toBuffer() doesn't work if there is a newline
		const msgHash = ethers.utils.hashMessage(message)
		const publicKey = ethers.utils.recoverPublicKey(msgHash, signature.trim())
		const address = ethers.utils.computeAddress(publicKey)
		const lowercaseAddress = address.toLowerCase()

		let isValid: boolean
		try {
			isValid = from === encodeEthAddress(this.bech32Prefix, lowercaseAddress)
		} catch (e) {
			isValid = false
		}
		return isValid
	}

	private async verifyCosmosSession(session: Session): Promise<boolean> {
		// decode "{ pub_key, signature }" to an object with { pubkey, signature }
		const { pubkey, signature: decodedSignature } = decodeSignature(JSON.parse(session.signature))

		const { prefix } = fromBech32(session.payload.from)
		if (session.payload.from !== toBech32(prefix, rawSecp256k1PubkeyToRawAddress(pubkey))) {
			throw new Error("Session signed with a pubkey that doesn't match the session address")
		}

		// the payload can either be signed directly, or encapsulated in a SignDoc
		const signDocPayload = await getSessionSignatureData(session.payload, session.payload.from) // TODO
		const signDocDigest = new Sha256(serializeSignDoc(signDocPayload)).digest()
		const serializedPayload = Buffer.from(serializeSessionPayload(session.payload))
		const digest = new Sha256(serializedPayload).digest()

		// compare the signature against the directly signed and signdoc digests
		const secpSignature = Secp256k1Signature.fromFixedLength(decodedSignature)
		return (
			(await Secp256k1.verifySignature(secpSignature, signDocDigest, pubkey)) ||
			(await Secp256k1.verifySignature(secpSignature, digest, pubkey))
		)
	}

	async verifySession(session: Session): Promise<void> {
		const { signature } = session

		let isValid
		if (signature.slice(0, 2) == "0x") {
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
		} else if (isFixedExtension(signer)) {
			return (await signer.connect()).address!
		} else {
			throw Error(`getSignerAddress called with invalid signer object!`)
		}
	}
	getDelegatedSignerAddress = async (privkey: Secp256k1WalletPrivateKey) => {
		const wallet = await Secp256k1Wallet.fromKey(privkey)
		return (await wallet.getAccounts())[0].address
	}

	isSigner(signer: unknown): signer is OfflineAminoSigner {
		return (
			typeof signer == "object" &&
			(isEvmMetaMaskSigner(signer) ||
				isKeplrEthereumSigner(signer) ||
				isFixedExtension(signer) ||
				isOfflineAminoSigner(signer))
		)
	}

	isDelegatedSigner(delegatedSigner: unknown): delegatedSigner is Secp256k1WalletPrivateKey {
		return delegatedSigner instanceof Uint8Array
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
		} else if (isFixedExtension(signer)) {
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

		let signature: string
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
		} else if (isFixedExtension(signer)) {
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
