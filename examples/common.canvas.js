export const database = "sqlite"

export const models = {
	threads: {
		id: "string",
		community: "string",
		creator: "string",
		title: "string",
		body: "string",
		link: "string",
		updated_at: "datetime",
		indexes: ["creator"],
	},
	comments: {
		id: "string",
		creator: "string",
		thread_id: "string",
		body: "string",
		parent_comment_id: "string",
		updated_at: "datetime",
		indexes: ["thread_id", "creator"],
	},
	thread_reactions: {
		id: "string",
		thread_id: "string",
		creator: "string",
		value: "integer",
		updated_at: "datetime",
		indexes: ["thread_id", "creator"],
	},
	comment_reactions: {
		id: "string",
		comment_id: "string",
		creator: "string",
		value: "integer",
		updated_at: "datetime",
		indexes: ["comment_id", "creator"],
	},
}

export const actions = {
	thread(community, title, body, link) {
		db.threads.set({ id: this.id, creator: this.from, community, title, body, link })
	},
	updateThread(thread_id, title, body) {
		const t = db.threads.find({ id: thread_id, creator: this.from })
		db.threads.set({ id: t.id, title, body })
	},
	deleteThread(thread_id) {
		const c = db.threads.find({ id: thread_id, creator: this.from })
		db.threads.delete({ id: c.id })
	},
	comment(thread_id, body, parent_comment_id) {
		db.comments.set({ id: this.id, creator: this.from, thread_id, body, parent_comment_id })
	},
	updateComment(comment_id, body) {
		const c = db.comments.find({ id: comment_id, creator: this.from })
		db.comments.set({ id: c.id, body })
	},
	deleteComment(comment_id) {
		const c = db.comments.find({ id: comment_id, creator: this.from })
		db.comments.delete({ id: c.id })
	},
	reactThread(thread_id, value) {
		assert(value === "like" || value === "dislike")
		db.thread_reactions.set({ id: `${thread_id}/${this.from}`, creator: this.from, thread_id, value })
	},
	unreactThread(thread_id, value) {
		db.thread_reactions.set({ id: `${thread_id}/${this.from}`, creator: this.from, thread_id, value: null })
	},
	reactComment(comment_id, value) {
		assert(value === "like" || value === "dislike")
		db.comment_reactions.set({ id: `${comment_id}/${this.from}`, creator: this.from, comment_id, value })
	},
	unreactComment(comment_id, value) {
		db.comment_reactions.set({ id: `${comment_id}/${this.from}`, creator: this.from, comment_id, value: null })
	},
}

export const routes = {}
