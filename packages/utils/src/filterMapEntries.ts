export const filterMapEntries = <K extends string, S, T>(object: Record<K, S>, filter: (entry: [key: K, value: S]) => boolean, map: (entry: [key: K, value: S]) => T) =>
	Object.fromEntries(Object.entries<S>(object).filter(([key, value]) => filter([key as K, value])).map(([key, value]) => [key, map([key as K, value])])) as Record<K, T>
