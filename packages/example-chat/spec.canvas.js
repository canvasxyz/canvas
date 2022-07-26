export const models = {
	posts: {
		content: "string",
		from_id: "string",
		indexes: ["updated_at"],
	},
	likes: {
		from_id: "string",
		post_id: "string",
		value: "boolean",
	},
}

export const routes = {
	"/posts":
		"SELECT posts.id, posts.from_id, posts.content, posts.updated_at, COUNT(CASE WHEN likes.value THEN 1 END) as likes, ARRAY_AGG(likes.from_id) as all_likes FROM posts LEFT JOIN likes ON likes.post_id = posts.id GROUP BY posts.id ORDER BY posts.updated_at DESC LIMIT 50",
	"/posts/as/:from_id":
		"SELECT posts.id, posts.from_id, posts.content, posts.updated_at, COUNT(CASE WHEN likes.value THEN 1 END) as likes, COUNT(CASE WHEN my_likes.value THEN 1 END) as my_likes, ARRAY_AGG(likes.from_id) as all_likes FROM posts LEFT JOIN likes ON likes.post_id = posts.id LEFT JOIN likes my_likes ON my_likes.post_id = posts.id AND my_likes.post_id = posts.id AND my_likes.from_id = $/from_id/ GROUP BY posts.id ORDER BY posts.updated_at DESC LIMIT 50",
}

export const actions = {
	createPost(content) {
		this.db.posts.set(this.hash, { content, from_id: this.from })
	},
	like(postId) {
		this.db.likes.set(`${this.from}/${postId}`, {
			from_id: this.from,
			post_id: postId,
			value: true,
		})
	},
	unlike(postId) {
		this.db.likes.set(`${this.from}/${postId}`, {
			from_id: this.from,
			post_id: postId,
			value: false,
		})
	},
}
