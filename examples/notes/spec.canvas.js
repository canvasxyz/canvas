export const models = {
	notes: {
		id: "string",
		local_key: "string",
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
			`SELECT id, from_id, title, body, updated_at, local_key FROM notes ORDER BY updated_at DESC LIMIT 50 OFFSET :offset`,
			{
				offset,
			}
		),
}

export const actions = {
	createUpdateNote({ body, id, title, local_key }, { db, hash, from }) {
		const key = id ? `${from}/${id.split("/")[1]}` : `${from}/${hash}`
		db.notes.set(key, { title, body, from_id: from, local_key })
	},

	deleteNote({ id }, { db, from }) {
		db.notes.delete(`${from}/${id.split("/")[1]}`)
	},
}
