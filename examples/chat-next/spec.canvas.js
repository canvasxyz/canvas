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
	"/posts": ({ offset = 0 }, { query }) =>
		query.raw(`SELECT id, from_id, content, updated_at FROM posts ORDER BY updated_at DESC LIMIT 50 OFFSET :offset`, {
			offset,
		}),
}

export const actions = {
	createPost({ content }, { db, hash, from }) {
		db.posts.set(hash, { content, from_id: from })
	},
}
