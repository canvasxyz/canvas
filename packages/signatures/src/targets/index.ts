export interface PlatformTarget {
	get(key: string): string | null
	set(key: string, value: string): void
	clear(prefix?: string): void

	keys(prefix?: string): IterableIterator<string>
	entries(prefix?: string): IterableIterator<[string, string]>

	getDomain(): string

	sha256(input: Uint8Array | Iterable<Uint8Array>): Uint8Array
}
