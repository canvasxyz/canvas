const models = {
	posts: {
		content: "string",
		fromId: "string",
	},
	likes: {
		postId: "string",
		value: "boolean",
	},
}

const routes = {
	"/posts":
		"SELECT posts.id, posts.fromId, posts.content, posts.timestamp, COUNT(IIF(likes.value, 1, NULL)) as likes FROM posts LEFT JOIN likes ON likes.postId = posts.id GROUP BY posts.id",
}

const actions = {
	createPost(content) {
		this.db.posts.set(this.hash, { content, fromId: this.from })
	},
	like(postId) {
		this.db.likes.set(this.from + postId, { postId, value: true })
	},
	unlike(postId) {
		this.db.likes.set(this.from + postId, { postId, value: false })
	},
}

export { models, routes, actions }
