export const models = {
	posts: {
		id: "string",
		content: "string",
		from_id: "string",
		updated_at: "datetime",
		indexes: ["updated_at"],
	},
}

export const routes = {
	"/posts": `SELECT id, from_id, content, updated_at FROM posts ORDER BY updated_at DESC LIMIT 50`,
	"/posts/:from_id": `SELECT id, from_id, content, updated_at FROM posts ORDER BY updated_at DESC LIMIT 50`,
}

export const actions = {
	createPost(content) {
		this.db.posts.set(this.hash, { content, from_id: this.from })
	},
}
