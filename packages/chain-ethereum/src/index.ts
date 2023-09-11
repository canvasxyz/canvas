import { AbstractSigner, Wallet, computeAddress, verifyMessage, hexlify, getBytes } from "ethers"

import * as siwe from "siwe"

import type { Signer, Action, SessionStore, SessionPayload, Message, IPLDValue } from "@canvas-js/interfaces"
import { Signature, createSignature } from "@canvas-js/signed-cid"
import { secp256k1 } from "@noble/curves/secp256k1"

import { getDomain } from "@canvas-js/chain-ethereum/domain"

export const SIWEMessageVersion = "1"

export type SIWESession = {
	signature: Uint8Array
	data: SIWESessionData
}

export type SIWESessionData = {
	version: string
	address: string
	chainId: number
	domain: string
	uri: string
	nonce: string
	issuedAt: string
	expirationTime: string | null
}

export interface SIWESignerInit {
	chain?: string
	signer?: AbstractSigner
	sessionDuration?: number
	store?: SessionStore
}

export class SIWESigner implements Signer {
	public static async init(init: SIWESignerInit): Promise<SIWESigner> {
		const signer = init.signer ?? Wallet.createRandom()
		const address = await signer.getAddress()

		const chain = init.chain || "eip155:1"
		const chainId = parseChainId(chain)

		const { sessionDuration, store } = init
		if (store !== undefined) {
			const privateSessionData = await store.load(address, chain)
			if (privateSessionData !== null) {
				const session = JSON.parse(privateSessionData)
				return new SIWESigner(address, chain, session, { sessionDuration, store })
			}
		}

		const session = await generateNewSession(signer, chainId, sessionDuration)
		if (store !== undefined) {
			await store.save(address, chain, JSON.stringify(session))
		}

		return new SIWESigner(address, chain, session, { sessionDuration, store })
	}

	public static validateSessionPayload = (session: SessionPayload): session is SIWESession => {
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

	private constructor(
		public readonly address: string,
		public readonly chain: string,

		private readonly session: { data: SIWESessionData; signature: string; privateKey: string },
		private readonly options: { sessionDuration?: number; store?: SessionStore }
	) {}

	public readonly match = (chain: string) => chainPattern.test(chain)

	private async save() {
		await this.options.store?.save(this.address, this.chain, JSON.stringify(this.session))
	}

	public verifySession(signature: Signature, chain: string, address: string, session: IPLDValue) {
		if (signature.type !== "secp256k1") {
			throw new Error("SIWE actions must use secp256k1 signatures")
		}

		const chainId = parseChainId(chain)
		assert(SIWESigner.validateSessionPayload(session), "invalid session")
		assert(session.data.version === SIWEMessageVersion, "invalid session version")
		assert(session.data.address === address, "invalid session address")
		assert(session.data.chainId === chainId, "invalid session chainId")
		assert(session.data.uri === getSessionURI(chainId, computeAddress(hexlify(signature.publicKey))))

		// TODO: validate issuedAt?

		const siweMessage = prepareSIWEMessage(session.data)
		const recoveredAddress = verifyMessage(siweMessage, hexlify(session.signature))
		if (recoveredAddress !== address) {
			throw new Error("invalid SIWE signature")
		}
	}

	public getSession(): SIWESession {
		// TODO: create a new session if the current session is expired or about to expire
		return { data: this.session.data, signature: getBytes(this.session.signature) }
	}

	public sign(message: Message<Action>): Signature {
		const { session } = message.payload
		assert(SIWESigner.validateSessionPayload(session))
		assert(session.data.address === this.address, "invalid session address")

		const privateKey = getBytes(this.session.privateKey)
		const publicKey = secp256k1.getPublicKey(privateKey, true)
		const sessionAddress = computeAddress(hexlify(publicKey))
		const sessionURI = getSessionURI(parseChainId(this.chain), sessionAddress)
		assert(session.data.uri === sessionURI)

		return createSignature("secp256k1", privateKey, message)
	}
}

function prepareSIWEMessage(data: SIWESessionData): string {
	const message = new siwe.SiweMessage({
		version: data.version,
		domain: data.domain,
		nonce: data.nonce,
		address: data.address,
		uri: data.uri,
		chainId: data.chainId,
		issuedAt: data.issuedAt,
		expirationTime: data.expirationTime ?? undefined,
	}).prepareMessage()

	return message
}

const chainPattern = /^eip155:(\d+)$/

function parseChainId(chain: string): number {
	const chainPatternMatch = chainPattern.exec(chain)
	if (chainPatternMatch === null) {
		throw new Error(`invalid chain: ${chain} did not match ${chainPattern}`)
	}

	const [_, chainId] = chainPatternMatch
	return parseInt(chainId)
}

function getSessionURI(chainId: number, sessionAddress: string) {
	return `eip155:${chainId}:${sessionAddress}`
}

async function generateNewSession(
	signer: AbstractSigner,
	chainId: number,
	sessionDuration?: number
): Promise<{ data: SIWESessionData; signature: string; privateKey: string }> {
	const address = await signer.getAddress()
	const domain = getDomain()

	const privateKey = hexlify(secp256k1.utils.randomPrivateKey())
	const sessionAddress = computeAddress(privateKey)

	const issuedAt = new Date()

	const data: SIWESessionData = {
		version: SIWEMessageVersion,
		address: address,
		chainId: chainId,
		domain: domain,
		uri: getSessionURI(chainId, sessionAddress),
		nonce: siwe.generateNonce(),
		issuedAt: issuedAt.toISOString(),
		expirationTime: null,
	}

	if (sessionDuration !== undefined) {
		const expirationTime = new Date(issuedAt.valueOf() + sessionDuration)
		data.expirationTime = expirationTime.toISOString()
	}

	const siweMessage = prepareSIWEMessage(data)
	const signature = await signer.signMessage(siweMessage)
	return { data, signature, privateKey }
}

function assert(condition: boolean, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}
