export class DelayableController {
	#interval: number
	#controller: AbortController
	#timer: ReturnType<typeof setTimeout>
	signal: AbortSignal

	constructor(interval: number) {
		this.#interval = interval
		this.#controller = new AbortController()
		this.signal = this.#controller.signal
		this.#timer = setTimeout(() => {
			this.#controller.abort()
		}, this.#interval)
	}

	delay() {
		clearTimeout(this.#timer)
		this.#timer = setTimeout(() => {
			this.#controller.abort()
		}, this.#interval)
	}

	clear() {
		clearTimeout(this.#timer)
	}
}
