import { Wallet } from "ethers"
import * as solw3 from "@solana/web3.js"
import nacl from "tweetnacl"
import { Keyring } from "@polkadot/api"
import { mnemonicGenerate } from "@polkadot/util-crypto"

import { EthereumChainImplementation } from "@canvas-js/chain-ethereum"
import { SolanaChainImplementation } from "@canvas-js/chain-solana"
import { ExtensionAndAddress, SubstrateChainImplementation } from "@canvas-js/chain-substrate"
import { WalletMock } from "@canvas-js/interfaces"

export class EthereumWalletMock implements WalletMock<EthereumChainImplementation> {
	createSigner() {
		return Wallet.createRandom()
	}
}

export class SolanaMock implements WalletMock<SolanaChainImplementation> {
	createSigner() {
		const keypair = solw3.Keypair.generate()

		return {
			isPhantom: true,
			isConnected: true,
			connect: async () => {},
			disconnect: async () => {},
			publicKey: { toBytes: () => keypair.publicKey.toBytes() },
			signMessage: async (message: Uint8Array) => {
				const signatureBytes = nacl.sign.detached(message, keypair.secretKey)
				return { signature: signatureBytes }
			},
			_handleDisconnect: (...args: unknown[]) => {},
		}
	}
}

export class SubstrateMock implements WalletMock<SubstrateChainImplementation> {
	createSigner() {
		const keyring: Keyring = new Keyring({ ss58Format: 42 })
		const mnemonic = mnemonicGenerate()
		const pair = keyring.addFromUri(mnemonic, {}) // use sr25519 by default

		return {
			extension: {
				name: "",
				version: "",
				accounts: {
					get: async () => [],
					subscribe: (cb: any) => () => {},
				},
				signer: {
					signRaw: async (payload) => {
						const signatureBytes = pair.sign(payload.data)
						const signature = `0x${Buffer.from(signatureBytes).toString("hex")}`
						return { id: 0, signature }
					},
				},
			},
			address: pair.address,
		} as ExtensionAndAddress
	}
}
