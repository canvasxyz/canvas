import { Secp256k1Wallet } from "@cosmjs/amino"
import { Random } from "@cosmjs/crypto"
import { RawKey } from "@terra-money/feather.js"
import { FixedExtension } from "@terra-money/wallet-controller/modules/legacy-extension"
import { ethers } from "ethers"
import { arrayify } from "ethers/lib/utils.js"
import { KeplrEthereumSigner } from "./signerInterface.js"

export async function createMockCosmosSigner() {
	const entropyLength = 4 * Math.floor((11 * 24) / 33)
	const privkeyBytes = Random.getBytes(entropyLength)
	const wallet = await Secp256k1Wallet.fromKey(privkeyBytes)
	return wallet
}

export async function createMockTerraSigner(): Promise<FixedExtension> {
	const entropyLength = 4 * Math.floor((11 * 24) / 33)
	const privkeyBytes = Random.getBytes(entropyLength)
	const wallet = new RawKey(Buffer.from(privkeyBytes))

	const address: string = wallet.accAddress("cosmos")

	return {
		post: (data: any) => {
			throw Error("Not implemented!")
		},
		sign: (data: any) => {
			throw Error("Not implemented!")
		},
		signBytes: async (bytes: Buffer) => {
			// Copied from:
			// https://github.com/terra-money/station/blob/f705f3e69d139a8bb4e4a6c669d90322ac0711c5/src/auth/hooks/useAuth.ts#L216
			const signature = await wallet.sign(bytes)
			return {
				payload: {
					result: {
						public_key: wallet.publicKey?.toAmino().value as string,
						recid: 1,
						signature: Buffer.from(signature).toString("base64"),
					},
				},
			}
		},
		info: () => {
			throw Error("Not implemented!")
		},
		connect: async () => {
			return {
				address,
			}
		},
		inTransactionProgress: () => false,
		disconnect: () => {
			throw Error("Not implemented!")
		},
	}
}

export async function createMockKeplrEthereumSigner(): Promise<KeplrEthereumSigner> {
	const wallet = ethers.Wallet.createRandom()
	return {
		getOfflineSigner: () => ({
			getAccounts: () => [
				{
					address: wallet.address,
					algo: "secp256k1",
					pubkey: arrayify(wallet.publicKey),
				},
			],
		}),
		signEthereum: async (chainId: string, address: string, dataToSign: string, ethSignType) => {
			const signatureStr = await wallet.signMessage(dataToSign)
			return arrayify(signatureStr)
		},
	}
}
