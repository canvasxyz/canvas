export const database = "sqlite"

export const models = {
	posts: {
		id: "string",
		content: "string",
		from_id: "string",
		updated_at: "datetime",
		indexes: ["updated_at"],
	},
	likes: {
		id: "string",
		from_id: "string",
		post_id: "string",
		updated_at: "datetime",
	},
}

export const routes = {
	"/posts": `SELECT posts.id, posts.from_id, posts.content, posts.updated_at, COUNT(*) as likes, group_concat(likes.from_id) as all_likes FROM posts LEFT JOIN likes ON likes.post_id = posts.id GROUP BY posts.id ORDER BY posts.updated_at DESC LIMIT 50`,
	"/posts/as/:from_id":
		"SELECT posts.id, posts.from_id, posts.content, posts.updated_at, COUNT(likes.id) as likes, COUNT(my_likes.id) as my_likes, group_concat(likes.from_id) as all_likes FROM posts LEFT JOIN likes ON likes.post_id = posts.id LEFT JOIN likes my_likes ON my_likes.post_id = posts.id AND my_likes.post_id = posts.id AND my_likes.from_id = :from_id GROUP BY posts.id ORDER BY posts.updated_at DESC LIMIT 50",
}

export const actions = {
	createPost(content) {
		this.db.posts.set(this.hash, { content, from_id: this.from })
	},
	like(postId) {
		this.db.likes.set(`${this.from}/${postId}`, { from_id: this.from, post_id: postId, value: true })
	},
	unlike(postId) {
		this.db.likes.delete(`${this.from}/${postId}`)
	},
}
