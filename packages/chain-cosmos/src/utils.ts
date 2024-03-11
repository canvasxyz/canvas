import type { CosmosSessionData } from "./types.js"

export const addressPattern = /^cosmos:([0-9a-z\-_]+):([a-zA-Fa-f0-9]+)$/

export function parseAddress(address: string): [chain: string, walletAddress: string] {
	const result = addressPattern.exec(address)
	if (result === null) {
		throw new Error(`invalid address: ${address} did not match ${addressPattern}`)
	}

	const [_, chain, walletAddress] = result
	return [chain, walletAddress]
}

export function validateSessionData(data: unknown): data is CosmosSessionData {
	try {
		extractSessionData(data)
	} catch (error) {
		return false
	}

	return true
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
	}
	throw Error(`invalid session data`)
}
