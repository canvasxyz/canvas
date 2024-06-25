import { zip } from "./zip.js"

export const mapValuesAsync = async <K extends string, S, T>(object: Record<K, S>, map: (value: S) => Promise<T>) => {
	const values = await Promise.all(Object.values<S>(object).map((value) => map(value)))
	return Object.fromEntries(zip(Object.keys(object), values))
}
