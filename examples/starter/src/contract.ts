import type { Actions, ModelSchema } from "@canvas-js/core"

export const models = {
	counter: {
		id: "primary",
		count: "number",
	},
} satisfies ModelSchema

export const actions = {
	async increment() {
		await this.db.transaction(async () => {
			const counter = await this.db.get("counter", "0")
			const count = counter ? counter.count : 0
			this.db.set("counter", { id: "0", count: count + 1 })
		})
	},
} satisfies Actions<typeof models>
