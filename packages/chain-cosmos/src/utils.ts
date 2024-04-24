import { EthereumSignedSessionData } from "./external_signers/ethereum.js"
import type { CosmosSessionData, CosmosMessage } from "./types.js"

export const addressPattern = /^cosmos:([0-9a-z\-_]+):([a-zA-Fa-f0-9]+)$/

// Later we may want to accept a version of this message that includes
// the domain we're signing in from. Wallets don't seem to check right now,
// so we can probably commit to accepting both formats as valid signatures.
// We may also want to have each signer pass an "ecosystem" string to follow
// the CAIP-122 recommendation, but inferring the ecosystem from the message is
// nontrivially difficult.
export function constructSiwxMessage(message: CosmosMessage): string {
	return `This website wants you to sign in with your Cosmos account:
${message.address}

Allow it to read and write to the application on your behalf?

URI: ${message.topic}
Version: 1
Issued At: ${message.issuedAt}
Expiration Time: ${message.expirationTime}
Chain ID: ${message.chainId}
Resources:
- ${message.publicKey}`
}

export function parseAddress(address: string): [chain: string, walletAddress: string] {
	const result = addressPattern.exec(address)
	if (result === null) {
		throw new Error(`invalid address: ${address} did not match ${addressPattern}`)
	}

	const [_, chain, walletAddress] = result
	return [chain, walletAddress]
}

function extractSessionData(data: any): CosmosSessionData {
	if (data.signatureType == "amino") {
		const signature = data.signature
		if (signature instanceof Uint8Array) {
			return {
				signatureType: "amino",
				signature,
			}
		}
	} else if (data.signatureType == "bytes") {
		const signature = data.signature.signature
		const pub_key_value = data.signature.pub_key.value
		const pub_key_type = data.signature.pub_key.type
		if (
			signature instanceof Uint8Array &&
			pub_key_value instanceof Uint8Array &&
			typeof pub_key_type === "string" &&
			pub_key_type == "tendermint/PubKeySecp256k1"
		) {
			return {
				signatureType: "bytes",
				signature: {
					signature: data.signature.signature,
					pub_key: {
						type: data.signature.pub_key.type,
						value: data.signature.pub_key.value,
					},
				},
			}
		}
	} else if (data.signatureType == "ethereum") {
		const signature = data.signature
		if (signature instanceof Uint8Array) {
			return {
				signatureType: "ethereum",
				signature: signature,
			}
		}
	} else if (data.signatureType == "arbitrary") {
		const signature = data.signature
		if (signature.pub_key instanceof Object && signature.signature instanceof Uint8Array) {
			return {
				signatureType: "arbitrary",
				signature: {
					pub_key: {
						type: signature.pub_key.type,
						value: signature.pub_key.value,
					},
					signature: signature.signature,
				},
			}
		}
	}
	throw Error(`invalid session data`)
}
