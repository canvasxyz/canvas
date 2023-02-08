import { Random } from "@cosmjs/crypto"
import { RawKey } from "@terra-money/feather.js"
import { FixedExtension } from "@terra-money/wallet-controller/modules/legacy-extension"

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
