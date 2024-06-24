// add elements with CacheMap.add(key, value) and they'll
// get shifted out in the order they were added.

export class CacheMap<K, V> extends Map<K, V> {
	constructor(
		public readonly capacity: number,
		entries?: Iterable<[K, V]>,
	) {
		super()

		for (const [key, value] of entries ?? []) {
			this.set(key, value)
		}
	}

	set(key: K, value: V) {
		super.set(key, value)
		for (const key of this.keys()) {
			if (this.size > this.capacity) {
				this.delete(key)
			} else {
				break
			}
		}

		return this
	}
}
