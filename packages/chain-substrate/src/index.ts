import { InjectedExtension } from "@polkadot/extension-inject/types"

import { Keyring } from "@polkadot/api"
import { Action, IPLDValue, Message, SessionPayload, Signer } from "@canvas-js/interfaces"
import { encode } from "microcbor"
import { Signature, createSignature } from "@canvas-js/signed-cid"
import { hexToU8a, u8aToHex } from "@polkadot/util"
import { decodeAddress, encodeAddress, mnemonicGenerate } from "@polkadot/util-crypto"
import nacl from "tweetnacl"
import { ed25519 } from "@noble/curves/ed25519"

// why isn't this type just exposed directly by polkadot?
// type KeyringPair = ReturnType<typeof Keyring.prototype.addFromUri>

export type SubstrateSession = {
	signature: Uint8Array
	data: SubstrateSessionData
}

// TODO: Which fields do we actually need?
export type SubstrateSessionData = {
	address: string
	chainId: string
	uri: string
	issuedAt: string
	expirationTime: string | null
}

type SubstrateSignerInit = {
	address: string
	extension?: InjectedExtension
}

const chainPattern = /^polkadot:([a-f0-9]+)$/

function parseChainId(chain: string): string {
	const chainPatternMatch = chainPattern.exec(chain)
	if (chainPatternMatch === null) {
		throw new Error(`invalid chain: ${chain} did not match ${chainPattern}`)
	}

	const [_, chainId] = chainPatternMatch
	return chainId
}

export class SubstrateSigner implements Signer {
	public static async initWithExtension({ extension, address }: SubstrateSignerInit): Promise<Signer> {
		if (extension === undefined) throw new Error("Invalid signer - no extension exists")

		const genesisHash = "0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3"
		const chainId = genesisHash.slice(2, 34)
		const session = await generateNewSession(
			address,
			async (data: Uint8Array) => {
				if (extension.signer.signRaw === undefined) throw new Error("Invalid signer - no signRaw method exists")
				const result = await extension.signer.signRaw({ address, data: u8aToHex(data), type: "bytes" })
				return result.signature
			},
			chainId
		)
		const chain = `polkadot:${chainId}`

		return new SubstrateSigner(address, chain, session)
	}

	public static async initWithKeypair(): Promise<Signer> {
		const keyring = new Keyring({ ss58Format: 42 })
		const mnemonic = mnemonicGenerate()
		const keypair = keyring.addFromMnemonic(mnemonic, {})
		const address = keypair.address

		const genesisHash = "0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3"
		const chainId = genesisHash.slice(2, 34)

		const session = await generateNewSession(address, async (data: Uint8Array) => u8aToHex(keypair.sign(data)), chainId)

		const chain = `polkadot:${chainId}`

		return new SubstrateSigner(address, chain, session)
	}

	private constructor(
		public readonly address: string,
		public readonly chain: string,
		private readonly session: { data: SubstrateSessionData; signature: string; privateKey: Uint8Array }
	) {}

	public readonly match = (chain: string) => chainPattern.test(chain)

	private static validateSessionPayload = (session: SessionPayload): session is SubstrateSession => {
		if (session === undefined || session === null) {
			return false
		} else if (typeof session === "boolean" || typeof session === "number" || typeof session === "string") {
			return false
		} else if (session instanceof Uint8Array) {
			return false
		} else if (Array.isArray(session)) {
			return false
		} else {
			// TODO: add real validation
			// return session.signature instanceof Uint8Array && ...
			return true
		}
	}

	public async verifySession(signature: Signature, chain: string, address: string, session: IPLDValue): Promise<void> {
		// check signature type - what type is it meant to be?
		if (signature.type !== "ed25519") {
			throw new Error("Solana actions must use ed25519 signatures")
		}

		// validate payload fields?
		const chainId = parseChainId(chain)

		assert(SubstrateSigner.validateSessionPayload(session), "invalid session")
		assert(session.data.address === address, "invalid session address")
		assert(session.data.chainId === chainId, "invalid session chain")
		assert(session.data.uri === getSessionURI(chainId, encodeAddress(signature.publicKey)), "invalid session uri")

		const solanaMessage = encode(session.data)
		const valid = nacl.sign.detached.verify(solanaMessage, session.signature, decodeAddress(address))
		if (!valid) {
			throw new Error("Invalid action signature")
		}
	}

	public async getSession(): Promise<IPLDValue> {
		return { data: this.session.data, signature: hexToU8a(this.session.signature) }
	}

	public sign(message: Message<Action>): Signature {
		return createSignature("ed25519", this.session.privateKey, message)
	}
}

function getSessionURI(chain: string, address: string): string {
	return `polkadot:${chain}:${address}`
}

async function generateNewSession(
	address: string,
	sign: (message: Uint8Array) => Promise<string>,
	chainId: string,
	sessionDuration?: number
): Promise<{ data: SubstrateSessionData; signature: string; privateKey: Uint8Array }> {
	const privateKey = ed25519.utils.randomPrivateKey()
	const publicKey = ed25519.getPublicKey(privateKey)
	const sessionAddress = encodeAddress(publicKey)
	const issuedAt = new Date()

	const data: SubstrateSessionData = {
		address,
		chainId,
		uri: getSessionURI(chainId, sessionAddress),
		issuedAt: issuedAt.toISOString(),
		expirationTime: null,
	}

	if (sessionDuration !== undefined) {
		const expirationTime = new Date(issuedAt.valueOf() + sessionDuration)
		data.expirationTime = expirationTime.toISOString()
	}

	const substrateMessage = encode(data)
	const signature = await sign(substrateMessage)

	return { data, signature, privateKey }
}

function assert(condition: boolean, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}
