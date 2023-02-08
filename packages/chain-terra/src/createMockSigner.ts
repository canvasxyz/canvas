import { Secp256k1Wallet } from "@cosmjs/amino"
import { Random } from "@cosmjs/crypto"
import { FixedExtension } from "@terra-money/wallet-controller/modules/legacy-extension"
import { makeArbitraryStdSignDoc } from "./signatureData.js"

export async function createMockTerraSigner(): Promise<FixedExtension> {
	const entropyLength = 4 * Math.floor((11 * 24) / 33)
	const privkeyBytes = Random.getBytes(entropyLength)
	const wallet = await Secp256k1Wallet.fromKey(privkeyBytes)

	return {
		connect: async () => {
			const account = (await wallet.getAccounts())[0]
			return { address: account.address }
		},
		signBytes: async (bytesToSign: any) => {
			const account = (await wallet.getAccounts())[0]

			const stdSignDoc = await makeArbitraryStdSignDoc(bytesToSign, account.address)
			const { signature } = await wallet.signAmino(account.address, stdSignDoc)

			return {
				payload: {
					result: {
						signature: signature.signature,
						public_key: Buffer.from(account.pubkey).toString("hex"),
						recid: 0,
					},
				},
			}
		},
		sign: async (data: any) => {
			throw Error("Not implemented!")
		},
		post: (data: any) => {
			throw Error("Not implemented!")
		},
		disconnect: () => {},
		info: () => {
			throw Error("Not implemented!")
		},
		inTransactionProgress: () => false,
	}
}
