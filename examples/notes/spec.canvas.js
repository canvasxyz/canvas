export const models = {
	notes: {
		id: "string",
		title: "string",
		body: "string",
		from_id: "string",
		updated_at: "datetime",
		indexes: ["updated_at"],
	},
}

export const routes = {
	"/notes": ({ offset = 0 }, { db }) =>
		db.queryRaw(
			`SELECT id, from_id, title, body, updated_at FROM notes ORDER BY updated_at DESC LIMIT 50 OFFSET :offset`,
			{
				offset,
			}
		),
}

export const actions = {
	createNote({ content, title }, { db, hash, from }) {
		db.notes.set(`${from}/${hash}`, { title, body: content, from_id: from })
	},

	deleteNote({ id }, { db, hash, from }) {
		const hash = id.split("/")[1]
		db.notes.delete(`${from}/${hash}`)
	},

	updateNote({ content, id, title }, { db, hash, from }) {
		db.notes.set(`${from}/${id}`, { title, body: content, from_id: from })
	},
}
