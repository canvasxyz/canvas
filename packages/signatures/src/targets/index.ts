export interface PlatformTarget {
	get(key: string): string | null
	set(key: string, value: string): void
	clear(prefix?: string): void
	getAll(prefix?: string): string[]
	getFirst(prefix? :string): string | null

	getDomain(): string
}
