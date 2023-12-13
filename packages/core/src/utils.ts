import AggregateError from "aggregate-error"
import { CodeError } from "@libp2p/interface"
import { anySignal } from "any-signal"

export function assert(condition: unknown, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}

export const mapEntries = <K extends string, S, T>(object: Record<K, S>, map: (entry: [key: K, value: S]) => T) =>
	Object.fromEntries(Object.entries<S>(object).map(([key, value]) => [key, map([key as K, value])])) as Record<K, T>

export const mapKeys = <K extends string, S, T>(object: Record<K, S>, map: (key: K) => T) =>
	Object.fromEntries(Object.entries<S>(object).map(([key, value]) => [key, map(key as K)])) as Record<K, T>

export const mapValues = <K extends string, S, T>(object: Record<K, S>, map: (value: S) => T) =>
	Object.fromEntries(Object.entries<S>(object).map(([key, value]) => [key, map(value)])) as Record<K, T>

export function signalInvalidType(type: never): never {
	console.error(type)
	throw new TypeError("internal error: invalid type")
}

export function getErrorMessage(err: unknown): string {
	if (err instanceof Error && err.name === "AggregateError") {
		const { errors } = err as AggregateError
		return errors.map(getErrorMessage).join("; ")
	} else if (err instanceof CodeError) {
		return `${err.code}: ${err.message}`
	} else if (err instanceof Error) {
		return `${err.name}: ${err.message}`
	} else {
		throw err
	}
}
