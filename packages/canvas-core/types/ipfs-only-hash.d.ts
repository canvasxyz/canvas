declare module "ipfs-only-hash" {
	export function of(input: string | Uint8Array | AsyncIterable<Uint8Array>, options?: {}): Promise<string>
}
