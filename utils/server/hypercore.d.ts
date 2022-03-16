declare module "hypercore" {
	interface Options {
		createIfMissing: boolean
		overwrite: boolean
		valueEncoding: "json" | "utf-8" | "binary"
		sparse: boolean
		eagerUpdate: boolean
		secretKey: Buffer
		storeSecretKey: boolean
		storageCacheSize: number
		onwrite: (index, data, peer, cb) => void
		stats: boolean
		crypto: {
			// sign (data, secretKey, cb(err, signature)) => void,
			// verify (signature, data, key, cb(err, valid)) => void
		}
		noiseKeyPair: { publicKey: string; secretKey: string }
	}

	class Feed {
		length: number
		on(event: "ready", callback: () => void)
	}

	export default function hypercore(
		storage: string,
		options?: Partial<Options>
	): Feed
}
