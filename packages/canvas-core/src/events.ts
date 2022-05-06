// Copied from https://github.com/libp2p/js-libp2p-interfaces/blob/ea8b08c3280203f2bc1644877647d46cbdc4c4e8/packages/libp2p-interfaces/src/events.ts

export interface EventCallback<EventType> {
	(evt: EventType): void
}

export type EventHandler<EventType> = EventCallback<EventType> | { handleEvent: EventCallback<EventType> } | null

interface Listener {
	once: boolean
	callback: any
}

/**
 * Adds types to the EventTarget class. Hopefully this won't be necessary forever.
 *
 * https://github.com/microsoft/TypeScript/issues/28357
 * https://github.com/microsoft/TypeScript/issues/43477
 * https://github.com/microsoft/TypeScript/issues/299
 * etc
 */
export class EventEmitter<EventMap> extends EventTarget {
	#listeners: Map<any, Listener[]> = new Map()

	listenerCount(type: string) {
		const listeners = this.#listeners.get(type)

		if (listeners == null) {
			return 0
		}

		return listeners.length
	}

	// @ts-expect-error EventTarget is not typed
	addEventListener<U extends keyof EventMap>(
		type: U,
		callback: EventHandler<EventMap[U]>,
		options?: AddEventListenerOptions | boolean
	) {
		// @ts-expect-error EventTarget is not typed
		super.addEventListener(type, callback, options)

		let list = this.#listeners.get(type)

		if (list == null) {
			list = []
			this.#listeners.set(type, list)
		}

		list.push({
			callback,
			once: (options !== true && options !== false && options?.once) ?? false,
		})
	}

	// @ts-expect-error EventTarget is not typed
	removeEventListener<U extends keyof EventMap>(
		type: U,
		callback?: EventHandler<EventMap[U]> | undefined,
		options?: EventListenerOptions | boolean
	) {
		// @ts-expect-error EventTarget is not typed
		super.removeEventListener(type, callback, options)

		let list = this.#listeners.get(type)

		if (list == null) {
			return
		}

		list = list.filter(({ callback: cb }) => cb !== callback)
		this.#listeners.set(type, list)
	}

	dispatchEvent(event: Event): boolean {
		const result = super.dispatchEvent(event)

		let list = this.#listeners.get(event.type)

		if (list == null) {
			return result
		}

		list = list.filter(({ once }) => !once)
		this.#listeners.set(event.type, list)

		return result
	}
}

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
