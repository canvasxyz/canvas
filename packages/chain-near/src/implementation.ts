// Most of the NEAR API is untested because the chain uses a hosted wallet for signing.

import { utils as nearApiUtils } from "near-api-js"
import nacl from "tweetnacl"
import bs58 from "bs58"

import type { Action, ActionPayload, ChainImplementation, Session, SessionPayload } from "@canvas-js/interfaces"
import { serializeActionPayload, serializeSessionPayload } from "@canvas-js/interfaces"

const getActionSignatureData = (payload: ActionPayload): Uint8Array => {
	return new TextEncoder().encode(serializeActionPayload(payload))
}
const getSessionSignatureData = (payload: SessionPayload): Uint8Array => {
	return new TextEncoder().encode(serializeSessionPayload(payload))
}

interface NearWindowSigner {}

/**
 * Near chain export.
 */
export class NearChainImplementation implements ChainImplementation<NearWindowSigner, nearApiUtils.KeyPairEd25519> {
	public readonly chain: string
	constructor(public readonly genesisHash: string = "mainnet") {
		// NEAR mainnet doesn't seem to have a well-defined genesis hash.
		this.chain = `near:${genesisHash.slice(0, 32)}`
	}

	hasProvider() {
		return false
	}

	async verifyAction(action: Action): Promise<void> {
		const expectedAddress = action.session ?? action.payload.from
		const message = getActionSignatureData(action.payload)
		const signatureBytes = bs58.decode(action.signature)
		const publicKey = nearApiUtils.PublicKey.fromString(expectedAddress)
		const valid = nacl.sign.detached.verify(message, signatureBytes, publicKey.data)
		if (!valid) {
			throw new Error("Invalid action signature")
		}
	}

	// TODO: We don't actually verify sessions on NEAR; the expected address is provided in the signature.
	// We should resolve the address to the public key using NEAR's PKI to complete a full verification.
	async verifySession(session: Session): Promise<void> {
		// const expectedAddress = session.payload.from
		const stringPayload = serializeSessionPayload(session.payload)
		const message = new TextEncoder().encode(stringPayload)
		const { signature: signatureEncoded, publicKey: publicKeyEncoded } = JSON.parse(session.signature)
		const publicKey = nearApiUtils.PublicKey.fromString(bs58.encode(Buffer.from(publicKeyEncoded, "base64")))
		const signatureBytes = Buffer.from(signatureEncoded, "base64")
		const valid = nacl.sign.detached.verify(message, signatureBytes, publicKey.data)
		if (!valid) {
			throw new Error("Invalid session signature")
		}
	}

	getSignerAddress = async (signer: NearWindowSigner) => {
		throw new Error("Unimplemented")
	}

	getDelegatedSignerAddress = async (keypair: nearApiUtils.KeyPairEd25519) => {
		throw new Error("Unimplemented")
	}

	async signSession(signer: NearWindowSigner, payload: SessionPayload): Promise<Session> {
		throw new Error("Unimplemented")
	}

	async signAction(signer: NearWindowSigner, payload: ActionPayload): Promise<Action> {
		throw new Error("Unimplemented")
	}

	async signDelegatedAction(keypair: nearApiUtils.KeyPairEd25519, payload: ActionPayload): Promise<Action> {
		// Untested!
		const message = getActionSignatureData(payload)
		const { signature: signatureBytes } = keypair.sign(message)
		const signature = bs58.encode(signatureBytes)
		return {
			type: "action",
			payload,
			signature,
			session: keypair.getPublicKey().toString(),
		}
	}

	importDelegatedSigner = (secretKey: string) => new nearApiUtils.KeyPairEd25519(secretKey)
	exportDelegatedSigner = (keypair: nearApiUtils.KeyPairEd25519) => keypair.secretKey
	generateDelegatedSigner = async (): Promise<nearApiUtils.KeyPairEd25519> => nearApiUtils.KeyPairEd25519.fromRandom()

	async getLatestBlock(): Promise<string> {
		throw new Error("Unimplemented")
	}
}
