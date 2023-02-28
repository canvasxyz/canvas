const CanvasChat = "ipfs://QmYAV9u6a3aHyhbPExMQauivZmrfyDdPH19yPZAZL6iF2e"

export const models = {
	posts: {
		id: "string",
		content: "string",
		from_id: "string",
		updated_at: "datetime",
		imported: "boolean",
		indexes: ["updated_at"],
	},
}

export const routes = {
	"/posts": ({ before = "" }, { db }) => {
		return db.queryRaw(`SELECT * FROM posts WHERE updated_at < :before ORDER BY updated_at DESC LIMIT 50`, {
			before,
		})
	},
	"/totalCount": ({}, { db }) => {
		return db.queryRaw(`SELECT COUNT(*) FROM posts`)
	},
}

export const actions = {
	createPost({ content }, { db, hash, from }) {
		db.posts.set(hash, { content, from_id: from, imported: false })
	},
}

export const sources = {
	[CanvasChat]: {
		createPost({ content }, { db, hash, from }) {
			db.posts.set(hash, { content, from_id: from, imported: true })
		},
	},
}
