export interface PlatformTarget {
	get(key: string): string | null
	set(key: string, value: string): void
	clear(prefix?: string): void
	getFirst(prefix? :string): string | null

	getDomain(): string
}
