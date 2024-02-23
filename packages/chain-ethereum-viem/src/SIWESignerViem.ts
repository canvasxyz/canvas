import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { toHex, toBytes, WalletClient, PrivateKeyAccount, verifyMessage } from "viem"

import * as siwe from "siwe"

import type { Session } from "@canvas-js/interfaces"
import { AbstractSessionData, AbstractSessionSigner, Ed25519Signer } from "@canvas-js/signatures"
import { assert } from "@canvas-js/utils"

import type { SIWESessionData, SIWEMessage } from "./types.js"
import { SIWEMessageVersion, validateSessionData, parseAddress, addressPattern, prepareSIWEMessage } from "./utils.js"

export interface SIWESignerViemInit {
	chainId?: number
	signer?: WalletClient | PrivateKeyAccount
	sessionDuration?: number
}

function isPrivateKeyAccount(signer: WalletClient | PrivateKeyAccount): signer is PrivateKeyAccount {
	return (signer as PrivateKeyAccount).source === "privateKey"
}

export class SIWESignerViem extends AbstractSessionSigner<SIWESessionData> {
	public readonly key: string
	public readonly sessionDuration: number | null
	public readonly chainId: number

	#account: {
		getAddress: () => Promise<`0x${string}`>
		sign: (message: string) => Promise<`0x${string}`>
	}

	public constructor(init: SIWESignerViemInit = {}) {
		super("chain-ethereum-viem", { createSigner: (init) => new Ed25519Signer(init) })
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
					const address = await this.#account.getAddress()
					return await walletClient.signMessage({ account: address, message })
				},
			}
		} else {
			// generate a random keypair
			const privateKey = generatePrivateKey()
			const pka = privateKeyToAccount(privateKey)

			this.#account = {
				getAddress: async () => {
					return pka.address
				},
				sign: async (message) => await pka.signMessage({ message }),
			}
		}

		this.sessionDuration = init.sessionDuration ?? null
		this.chainId = init.chainId ?? 1
		this.key = `SIWESignerViem-${init.signer ? "signer" : "burner"}`
	}

	public readonly match = (address: string) => addressPattern.test(address)
	public readonly verify = Ed25519Signer.verify

	public async verifySession(topic: string, session: Session<SIWESessionData>) {
		const { address, publicKey, authorizationData, timestamp, duration } = session

		assert(validateSessionData(authorizationData), "invalid session")
		const [chainId, walletAddress] = parseAddress(address)

		const siweMessage: SIWEMessage = {
			version: SIWEMessageVersion,
			domain: authorizationData.domain,
			nonce: authorizationData.nonce,
			chainId: chainId,
			address: walletAddress,
			uri: publicKey,
			issuedAt: new Date(timestamp).toISOString(),
			expirationTime: duration === null ? null : new Date(timestamp + duration).toISOString(),
			resources: [`canvas://${topic}`],
		}

		const isValid = await verifyMessage({
			address: walletAddress as `0x${string}`,
			message: prepareSIWEMessage(siweMessage),
			signature: toHex(authorizationData.signature),
		})

		assert(isValid, "invalid SIWE signature")
	}

	protected async getAddress(): Promise<string> {
		const walletAddress = await this.#account.getAddress()
		return `eip155:${this.chainId}:${walletAddress}`
	}

	protected async newSession(data: AbstractSessionData): Promise<Session<SIWESessionData>> {
		const { topic, address, publicKey, timestamp, duration } = data
		const domain = this.target.getDomain()
		const nonce = siwe.generateNonce()

		const [chainId, walletAddress] = parseAddress(address)
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
			address: address,
			publicKey: publicKey,
			authorizationData: { signature: toBytes(signature), domain, nonce },
			duration: duration,
			timestamp: timestamp,
			blockhash: null,
		}
	}
}
