import type { Actions, ModelSchema } from "@canvas-js/core"

export const models = {
	posts: {
		id: "primary",
		title: "string",
		text: "string",
		author: "string",
		timestamp: "number",
	},
} satisfies ModelSchema

export const actions: Actions<typeof models> = {
	createPost(title: string, text: string) {
		this.db.set("posts", { id: this.id, title, text, author: this.did, timestamp: this.timestamp })
	},
	deletePost(id: string) {
		if (this.address !== "0x34C3A5ea06a3A67229fb21a7043243B0eB3e853f") throw new Error()
		this.db.delete("posts", id)
	},
}
