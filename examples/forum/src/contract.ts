import { ModelSchema } from "@canvas-js/core"
import { Contract } from "@canvas-js/core/contract"

export default class Forum extends Contract<typeof Forum.models> {
	static models = {
		posts: {
			id: "primary",
			title: "string",
			text: "string",
			author: "string",
			timestamp: "number",
			$indexes: ["timestamp"],
		},
	} satisfies ModelSchema

	async createPost(title: string, text: string) {
		await this.db.set("posts", { id: this.id, title, text, author: this.did, timestamp: this.timestamp })
	}

	async deletePost(id: string) {
		if (this.address !== "0x34C3A5ea06a3A67229fb21a7043243B0eB3e853f") throw new Error()
		await this.db.delete("posts", id)
	}
}
