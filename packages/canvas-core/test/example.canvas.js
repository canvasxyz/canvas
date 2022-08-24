export const database = "sqlite"

export const models = {
	threads: {
		title: "string",
		link: "string",
		creator: "string",
	},
	comments: {
		thread_id: "string",
		text: "string",
		creator: "string",
	},
	thread_votes: {
		thread_id: "string",
		creator: "string",
		value: "integer",
	},
	comment_votes: {
		comment_id: "string",
		creator: "string",
		value: "integer",
	},
}

export const routes = {
	"/latest": `SELECT
	          threads.*,
	          SUM(
	              1 / (cast(strftime('%s','now') as float) * 1000 - thread_votes.updated_at) *
	              CAST(thread_votes.value as INT)
	          ) AS score,
	          group_concat(thread_votes.creator) as voters
	      FROM threads
	          LEFT JOIN thread_votes ON threads.id = thread_votes.thread_id
	      GROUP BY threads.id
	      ORDER BY threads.updated_at DESC
	      LIMIT 30`,
	"/top": `SELECT
	          threads.*,
	          SUM(
	              1 / (cast(strftime('%s','now') as float) * 1000 - thread_votes.updated_at) *
	              CAST(thread_votes.value as INT)
	          ) AS score,
	          group_concat(thread_votes.creator) as voters
	      FROM threads
	          LEFT JOIN thread_votes ON threads.id = thread_votes.thread_id
	      GROUP BY threads.id
	      ORDER BY score DESC
	      LIMIT 30`,
	"/threads/:thread_id": `SELECT
	          threads.*,
	          SUM(
	              1 / (cast(strftime('%s','now') as float) * 1000 - 'thread_votes'.updated_at) * thread_votes.value
	          ) AS score,
	          group_concat(thread_votes.creator) as voters
	      FROM threads
	          LEFT JOIN comments ON comments.thread_id = threads.id
	          LEFT JOIN thread_votes ON threads.id = thread_votes.thread_id
	          WHERE threads.id = :thread_id
	      GROUP BY threads.id`,
	"/threads/:thread_id/comments": `SELECT
	          comments.*,
	          SUM(
	              1 / (cast(strftime('%s','now') as float) * 1000 - comment_votes.updated_at) * comment_votes.value
	          ) AS score,
	          group_concat(comment_votes.creator) as voters
	      FROM comments
	          LEFT JOIN comment_votes ON comments.id = comment_votes.comment_id
	          WHERE comments.thread_id = :thread_id
	      GROUP BY comments.id
	      ORDER BY score DESC
	      LIMIT 30`,
}

export const actions = {
	newThread(title, link) {
		this.db.threads.set(this.hash, { creator: this.from, title, link })
	},
	newComment(threadId, text) {
		this.db.comments.set(this.hash, { creator: this.from, thread_id: threadId, text })
	},
	deleteThread(threadId) {
		this.db.threads.delete(threadId)
	},
	deleteComment() {
		this.db.comments.delete(commentId)
	},
	voteThread(threadId, value) {
		if (value !== 1 && value !== -1) {
			throw new Error("invalid vote value")
		}

		this.db.thread_votes.set(`${threadId}/${this.from}`, { creator: this.from, thread_id: threadId, value })
	},
	voteComment(commentId, value) {
		if (value !== 1 && value !== -1) {
			throw new Error("invalid vote value")
		}

		this.db.comment_votes.set(`${commentId}/${this.from}`, { creator: this.from, comment_id: commentId, value })
	},
}
