/**
 * CustomEvent is a standard event but it's not supported by node.
 *
 * Remove this when https://github.com/nodejs/node/issues/40678 is closed.
 *
 * Ref: https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent
 */
class CustomEventPolyfill<T = any> extends Event {
	/** Returns any custom data event was created with. Typically used for synthetic events. */
	public detail: T

	constructor(message: string, data?: EventInit & { detail: T }) {
		super(message, data)
		// @ts-expect-error could be undefined
		this.detail = data?.detail
	}
}

export const CustomEvent = globalThis.CustomEvent ?? CustomEventPolyfill
