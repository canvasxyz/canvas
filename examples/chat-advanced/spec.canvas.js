const CanvasChat = "ipfs://QmShbAFGESPX8MgvJt39Gzdm2KcQzvysdHW8vgVpRKStL9"

export const chains = ["eip155:1"]

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
	"/posts": ({ before = "" }, { db }) => {
		return db.queryRaw(`SELECT * FROM posts WHERE updated_at < :before ORDER BY updated_at DESC LIMIT 50`, { before })
	},
}

export const actions = {
	createPost({ content }, { db, hash, from }) {
		db.posts.set(hash, { content, from_id: from })
	},
}

export const sources = {
	[CanvasChat]: {
		createPost({ content }, { db, hash, from }) {
			db.posts.set(hash, { content, from_id: from, imported: true })
		},
	},
}
