import type { ModelSchema } from "@canvas-js/core"
import { Contract } from "@canvas-js/core/contract"

export default class Counter extends Contract<typeof Counter.models> {
	static models = {
		counter: {
			id: "primary",
			count: "number",
		},
	} satisfies ModelSchema

	async increment() {
		await this.db.transaction(async () => {
			const counter = await this.db.get("counter", "0")
			const count = counter ? counter.count : 0
			await this.db.set("counter", { id: "0", count: count + 1 })
		})
	}
}
