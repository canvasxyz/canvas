export const models = {
	posts: {
		content: "string",
		from_id: "string",
		indexes: ["updated_at"],
	},
	likes: {
		post_id: "string",
		value: "boolean",
	},
}

export const routes = {
	"/posts":
		"SELECT posts.id, posts.from_id, posts.content, posts.updated_at, COUNT(IIF(likes.value, 1, NULL)) as likes FROM posts LEFT JOIN likes ON likes.post_id = posts.id GROUP BY posts.id ORDER BY posts.updated_at DESC LIMIT 50",
}

export const actions = {
	createPost(content) {
		this.db.posts.set(this.hash, { content, from_id: this.from })
	},
	like(postId) {
		this.db.likes.set(`${this.from}/${postId}`, { post_id: postId, value: true })
	},
	unlike(postId) {
		this.db.likes.set(`${this.from}/${postId}`, { post_id: postId, value: false })
	},
}
