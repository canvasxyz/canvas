import solw3 from "@solana/web3.js"

import { Action, ActionArguments, ActionContext, Env, Message, SessionPayload, Signer } from "@canvas-js/interfaces"
import { encode } from "microcbor"
import { Signature, createSignature, verifySignature } from "@canvas-js/signed-cid"
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

type SolanaSignerInit = {
	signer?: solw3.Keypair
}

function parseChainId(chain: string): string {
	const chainPattern = /^solana:([a-z]+)$/
	const chainPatternMatch = chainPattern.exec(chain)
	if (chainPatternMatch === null) {
		throw new Error(`invalid chain: ${chain} did not match ${chainPattern}`)
	}

	const [_, chainId] = chainPatternMatch
	return chainId
}

export class SolanaSigner implements Signer {
	public static async init(init: SolanaSignerInit): Promise<Signer> {
		const signer = init.signer ?? solw3.Keypair.generate()
		const address = bs58.encode(signer.publicKey.toBytes())
		const genesisHash = "mainnet"
		const session = await generateNewSession(signer, genesisHash)
		const chain = `solana:${genesisHash.slice(0, 32)}`

		return new SolanaSigner(address, signer, chain, session)
	}

	private constructor(
		public readonly address: string,
		public readonly signer: solw3.Keypair,
		public readonly chain: string,
		private readonly session: { data: SolanaSessionData; signature: string; privateKey: string }
	) {}

	public match(chain: string) {
		return false
	}

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

	public verify(signature: Signature, message: Message<Action>): void {
		// check signature type - what type is it meant to be?
		if (signature.type !== "ed25519") {
			throw new Error("Solana actions must use ed25519 signatures")
		}

		const { chain, session, address } = message.payload

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

	public create(name: string, args: ActionArguments, context: ActionContext, env: Env): Action {
		return {
			chain: this.chain,
			address: this.address,
			session: { data: this.session.data, signature: bs58.decode(this.session.signature) },
			context: context,
			name: name,
			args: args,
		}
	}

	public sign(message: Message<Action>): Signature {
		return createSignature("ed25519", bs58.decode(this.session.privateKey), message)
	}
}

function getSessionURI(chain: string, address: string): string {
	return `solana:${chain}:${address}`
}

async function generateNewSession(
	signer: solw3.Keypair,
	chainId: string,
	sessionDuration?: number
): Promise<{ data: SolanaSessionData; signature: string; privateKey: string }> {
	const address = signer.publicKey.toBase58()
	const delegatedKeypair = solw3.Keypair.generate()

	const sessionAddress = delegatedKeypair.publicKey.toBase58()
	const issuedAt = new Date()

	const data: SolanaSessionData = {
		address: address,
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
	const signature = bs58.encode(nacl.sign.detached(solanaMessage, signer.secretKey))
	return { data, signature, privateKey: bs58.encode(privateKeyFromSolanaKeypair(delegatedKeypair)) }
}

function assert(condition: boolean, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}

function privateKeyFromSolanaKeypair(keypair: solw3.Keypair): Uint8Array {
	return keypair.secretKey.slice(0, 32)
}
