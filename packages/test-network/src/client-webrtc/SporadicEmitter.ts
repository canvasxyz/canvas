import { EventEmitter } from "node:events"

export class SporadicEmitter extends EventEmitter {
	#timeout: NodeJS.Timeout | null = null

	constructor(
		readonly averageInterval: number,
		start: boolean = true,
	) {
		super()
		if (start) {
			this.scheduleNext()
		}
	}

	start() {
		if (this.#timeout === null) {
			this.scheduleNext()
		}
	}

	stop() {
		if (this.#timeout) {
			clearTimeout(this.#timeout)
			this.#timeout = null
		}
	}

	scheduleNext() {
		// Exponential distribution: -ln(random) * average
		const interval = -Math.log(Math.random()) * this.averageInterval

		this.#timeout = setTimeout(() => {
			this.emit("event")
			this.scheduleNext()
		}, interval)
	}
}
