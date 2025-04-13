import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { toHex, toBytes, WalletClient, PrivateKeyAccount, verifyMessage } from "viem"

import * as siwe from "siwe"

import type { DidIdentifier, Session, AbstractSessionData } from "@canvas-js/interfaces"
import { AbstractSessionSigner, ed25519 } from "@canvas-js/signatures"
import { assert } from "@canvas-js/utils"

import type { SIWESessionData, SIWEMessage } from "./types.js"
import { SIWEMessageVersion, validateSessionData, parseAddress, addressPattern, prepareSIWEMessage } from "./utils.js"

export interface SIWESignerViemInit {
	/** An abstract signer, implementing a minimal subset of methods on Viem WalletClient/PrivateKeyAccount
	 *
	 * If no signer is provided, SIWESignerViem will only read/accept actions, and will not
	 * be able to authorize new sessions or actions.  */
	signer?: WalletClient | PrivateKeyAccount

	/** Create a random burner account at the time of initialization.
	 * Default: false. */
	burner?: boolean

	/** Ethereum Chain ID to issue did:pkh identities on. Default: 1. */
	chainId?: number

	/** Duration that sessions should be valid for. Default: 14 days. */
	sessionDuration?: number
}

function isPrivateKeyAccount(signer: WalletClient | PrivateKeyAccount): signer is PrivateKeyAccount {
	return (signer as PrivateKeyAccount).source === "privateKey"
}

export class SIWESignerViem extends AbstractSessionSigner<SIWESessionData> {
	public readonly match = (address: string) => addressPattern.test(address)
	public readonly chainId: number

	#account: {
		getAddress: () => Promise<`0x${string}`>
		sign: (message: string) => Promise<`0x${string}`>
	} | null

	public constructor({ sessionDuration, ...init }: SIWESignerViemInit = {}) {
		super("chain-ethereum-viem", ed25519, { sessionDuration })

		if (init.signer && isPrivateKeyAccount(init.signer)) {
			// use passed PrivateKeyAccount
			const pka = init.signer
			this.#account = {
				getAddress: async () => {
					return pka.address
				},
				sign: async (message) => await pka.signMessage({ message }),
			}
		} else if (init.signer) {
			// use passed WalletClient
			const walletClient = init.signer
			this.#account = {
				getAddress: async () => {
					const addresses = await walletClient.getAddresses()
					const address = addresses[0]
					return address
				},
				sign: async (message) => {
					const addresses = await walletClient.getAddresses()
					const address = addresses[0]
					return await walletClient.signMessage({ account: address, message })
				},
			}
		} else if (init.burner) {
			// generate a random keypair
			const privateKey = generatePrivateKey()
			const pka = privateKeyToAccount(privateKey)

			this.#account = {
				getAddress: async () => {
					return pka.address
				},
				sign: async (message) => await pka.signMessage({ message }),
			}
		} else {
			this.#account = null
		}

		// this.sessionDuration = init.sessionDuration ?? null
		this.chainId = init.chainId ?? 1
	}

	public async verifySession(topic: string, session: Session<SIWESessionData>) {
		const {
			did,
			publicKey,
			authorizationData,
			context: { timestamp, duration },
		} = session

		assert(validateSessionData(authorizationData), "invalid session")
		const [chainId, walletAddress] = parseAddress(did)

		const siweMessage: SIWEMessage = {
			version: SIWEMessageVersion,
			domain: authorizationData.domain,
			nonce: authorizationData.nonce,
			chainId: chainId,
			address: walletAddress,
			uri: publicKey,
			issuedAt: new Date(timestamp).toISOString(),
			expirationTime: duration === undefined ? null : new Date(timestamp + duration).toISOString(),
			resources: [`canvas://${topic}`],
		}

		const isValid = await verifyMessage({
			address: walletAddress as `0x${string}`,
			message: prepareSIWEMessage(siweMessage),
			signature: toHex(authorizationData.signature),
		})

		assert(isValid, "invalid SIWE signature")
	}

	public async getDid(): Promise<DidIdentifier> {
		assert(this.#account !== null, "SIWESignerViem initialized without a signer in read-only mode")
		const walletAddress = await this.#account.getAddress()
		return `did:pkh:eip155:${this.chainId}:${walletAddress}`
	}

	public getDidParts(): number {
		return 5
	}

	public getAddressFromDid(did: DidIdentifier) {
		const [_, walletAddress] = parseAddress(did)
		return walletAddress
	}

	public async authorize(data: AbstractSessionData): Promise<Session<SIWESessionData>> {
		assert(this.#account !== null, "SIWESignerViem initialized without a signer in read-only mode")
		const {
			topic,
			did,
			publicKey,
			context: { timestamp, duration },
		} = data
		const domain = this.target.getDomain()
		const nonce = siwe.generateNonce()

		const [chainId, walletAddress] = parseAddress(did)
		const issuedAt = new Date(timestamp).toISOString()

		const siweMessage: SIWEMessage = {
			version: SIWEMessageVersion,
			address: walletAddress,
			chainId: chainId,
			domain: domain,
			uri: publicKey,
			nonce: nonce,
			issuedAt: issuedAt,
			expirationTime: null,
			resources: [`canvas://${topic}`],
		}

		if (this.sessionDuration !== null) {
			siweMessage.expirationTime = new Date(timestamp + this.sessionDuration).toISOString()
		}

		const signature = await this.#account.sign(prepareSIWEMessage(siweMessage))

		return {
			type: "session",
			did: did,
			publicKey: publicKey,
			authorizationData: { signature: toBytes(signature), domain, nonce },
			context: duration ? { duration, timestamp } : { timestamp },
		}
	}
}
