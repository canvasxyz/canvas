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

export const actions = {
	createPost(db, title: string, text: string) {
		this.db.set("posts", { id: this.id, title, text, author: this.did, timestamp: this.timestamp })
	},
} satisfies Actions<typeof models>
