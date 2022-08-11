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

export const actions = {
	thread(id, title, link) {
		db.threads.set(id, { creator: this.from, title, link })
	},
	comment(id, thread_id, text) {
		db.comments.set(id, { creator: this.from, thread_id, text })
	},
	voteThread(thread_id, value) {
		if (value !== 1 && value !== -1) return false
		db.thread_votes.set(`${thread_id}/${this.from}`, { creator: this.from, thread_id, value })
	},
	voteComment(comment_id, value) {
		if (value !== 1 && value !== -1) return false
		db.comment_votes.set(`${comment_id}/${this.from}`, { creator: this.from, comment_id, value })
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
                1 / (cast(strftime('%s','now') as float) * 1000 - thread_votes.updated_at) * thread_votes.value
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
