import solw3 from "@solana/web3.js"

import { Action, IPLDValue, Message, SessionPayload, Signer } from "@canvas-js/interfaces"
import { encode } from "microcbor"
import { Signature, createSignature } from "@canvas-js/signed-cid"
import bs58 from "bs58"
import nacl from "tweetnacl"

export type SolanaSession = {
	signature: Uint8Array
	data: SolanaSessionData
}

// TODO: Which fields do we actually need?
export type SolanaSessionData = {
	address: string
	chainId: string
	uri: string
	issuedAt: string
	expirationTime: string | null
}

// Solana doesn't publish TypeScript signatures for injected wallets, but we can assume
// most wallets expose a Phantom-like API and use their injected `window.solana` objects directly:
// https://github.com/solana-labs/wallet-adapter/commit/5a274e0a32c55d4376d63a802f0d512947b087af
interface SolanaWindowSigner {
	publicKey?: solw3.PublicKey
	signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>
}

const chainPattern = /^solana:([a-z]+)$/

function parseChainId(chain: string): string {
	const chainPatternMatch = chainPattern.exec(chain)
	if (chainPatternMatch === null) {
		throw new Error(`invalid chain: ${chain} did not match ${chainPattern}`)
	}

	const [_, chainId] = chainPatternMatch
	return chainId
}

export class SolanaSigner implements Signer {
	public static async initWithWindowSigner(signer: SolanaWindowSigner): Promise<Signer> {
		if (signer.publicKey === undefined) throw new Error("Invalid signer")

		const address = bs58.encode(signer.publicKey.toBytes())
		const genesisHash = "mainnet"
		const session = await generateNewSession(
			address,
			async (msg) => (await signer.signMessage(msg)).signature,
			genesisHash
		)

		const chain = `solana:${genesisHash.slice(0, 32)}`

		return new SolanaSigner(chain, address, session)
	}

	public static async initWithKeypair(): Promise<Signer> {
		const keypair = solw3.Keypair.generate()

		const address = bs58.encode(keypair.publicKey.toBytes())
		const genesisHash = "mainnet"
		const session = await generateNewSession(
			address,
			async (msg) => nacl.sign.detached(msg, keypair.secretKey),
			genesisHash
		)

		const chain = `solana:${genesisHash.slice(0, 32)}`

		return new SolanaSigner(chain, address, session)
	}

	private constructor(
		public readonly chain: string,
		public readonly address: string,
		private readonly session: { data: SolanaSessionData; signature: Uint8Array; secretKey: Uint8Array }
	) {}

	public readonly match = (chain: string) => chainPattern.test(chain)

	private static validateSessionPayload = (session: SessionPayload): session is SolanaSession => {
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

	public verifySession(signature: Signature, chain: string, address: string, session: IPLDValue): void {
		// check signature type - what type is it meant to be?
		if (signature.type !== "ed25519") {
			throw new Error("Solana actions must use ed25519 signatures")
		}

		// validate payload fields?
		const chainId = parseChainId(chain)

		assert(SolanaSigner.validateSessionPayload(session), "invalid session")
		assert(session.data.address === address, "invalid session address")
		assert(session.data.chainId === chainId, "invalid session chain")
		assert(session.data.uri === getSessionURI(chainId, bs58.encode(signature.publicKey)), "invalid session uri")

		const solanaMessage = encode(session.data)
		const valid = nacl.sign.detached.verify(solanaMessage, session.signature, bs58.decode(address))
		if (!valid) {
			throw new Error("Invalid action signature")
		}
	}

	public getSession(): SolanaSession {
		return { data: this.session.data, signature: this.session.signature }
	}

	public sign(message: Message<Action>): Signature {
		const privateKey = this.session.secretKey.slice(0, 32)
		return createSignature("ed25519", privateKey, message)
	}
}

function getSessionURI(chain: string, address: string): string {
	return `solana:${chain}:${address}`
}

async function generateNewSession(
	address: string,
	sign: (message: Uint8Array) => Promise<Uint8Array>,
	chainId: string,
	sessionDuration?: number
): Promise<{ data: SolanaSessionData; signature: Uint8Array; secretKey: Uint8Array }> {
	const delegatedKeypair = solw3.Keypair.generate()

	const sessionAddress = delegatedKeypair.publicKey.toBase58()
	const issuedAt = new Date()

	const data: SolanaSessionData = {
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

	const solanaMessage = encode(data)
	const signature = await sign(solanaMessage)

	return { data, signature, secretKey: delegatedKeypair.secretKey }
}

function assert(condition: boolean, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}
