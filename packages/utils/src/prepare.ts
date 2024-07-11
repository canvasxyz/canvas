import { Message } from "@canvas-js/interfaces"
import { JSValue } from "./values.js"

export function prepareMessage<T>(message: Message<T>, options: { replaceUndefined?: boolean } = { replaceUndefined: true }): Message<T> {
	return { ...message, payload: prepare(message.payload, options) }
}

/*
 * Prepare a DAG-JSON or DAG-CBOR object for
 * encoding by filtering undefined fields.
 *
 * If `replaceUndefined` is provided, replace
 * `undefined` with `null` at the root and
 * inside arrays.
 */
export function prepare<T>(node: T, { replaceUndefined }: { replaceUndefined?: boolean } = {}): T {
	if (Array.isArray(node)) {
		return (node as any[]).map((item) => prepare(item, { replaceUndefined })) as T
	}

	if (node !== null && typeof node === "object" && !(node instanceof Uint8Array)) {
		return Object.keys(node).reduce((acc: Record<string | symbol, JSValue>, key) => {
			const value = (node as any)[key]
			if (value === undefined) {
				// filter out undefined in objects
			} else {
				acc[key] = prepare(value, { replaceUndefined })
			}
			return acc
		}, {}) as T
	}

	if (node === undefined) {
		if (replaceUndefined) {
			return null as T
		} else {
			throw new Error("cannot encode message with value 'undefined'")
		}
	}

	return node
}
