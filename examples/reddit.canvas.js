export const models = {
	threads: {
		title: "string",
		link: "string",
		creator: "string",
	},
	comments: {
		threadId: "string",
		text: "string",
		creator: "string",
	},
	threadVotes: {
		threadId: "string",
		creator: "string",
		value: "integer",
	},
	commentVotes: {
		commentId: "string",
		creator: "string",
		value: "integer",
	},
}

export const routes = {
	"/latest": `SELECT
            threads.*,
            SUM(
                1 / (cast(strftime('%s','now') as float) * 1000 - threadVotes.timestamp) *
                CAST(threadVotes.value as INT)
            ) AS score,
            group_concat(threadVotes.creator) as voters
        FROM threads
            LEFT JOIN threadVotes ON threads.id = threadVotes.threadId
        GROUP BY threads.id
        ORDER BY threads.timestamp DESC
        LIMIT 30`,
	"/top": `SELECT
            threads.*,
            SUM(
                1 / (cast(strftime('%s','now') as float) * 1000 - threadVotes.timestamp) *
                CAST(threadVotes.value as INT)
            ) AS score,
            group_concat(threadVotes.creator) as voters
        FROM threads
            LEFT JOIN threadVotes ON threads.id = threadVotes.threadId
        GROUP BY threads.id
        ORDER BY score DESC
        LIMIT 30`,
	"/threads/:threadId": `SELECT
            threads.*,
            SUM(
                1 / (cast(strftime('%s','now') as float) * 1000 - threadVotes.timestamp) * threadVotes.value
            ) AS score,
            group_concat(threadVotes.creator) as voters
        FROM threads
            LEFT JOIN comments ON comments.threadId = threads.id
            LEFT JOIN threadVotes ON threads.id = threadVotes.threadId
            WHERE threads.id = :threadId
        GROUP BY threads.id`,
	"/threads/:threadId/comments": `SELECT
            comments.*,
            SUM(
                1 / (cast(strftime('%s','now') as float) * 1000 - commentVotes.timestamp) * commentVotes.value
            ) AS score,
            group_concat(commentVotes.creator) as voters
        FROM comments
            LEFT JOIN commentVotes ON comments.id = commentVotes.commentId
            WHERE comments.threadId = :threadId
        GROUP BY comments.id
        ORDER BY score DESC
        LIMIT 30`,
}

export const actions = {
	thread(id, title, link) {
		this.db.threads.set(id, { creator: this.from, title, link })
	},
	comment(id, threadId, text) {
		this.db.comments.set(id, { creator: this.from, threadId, text })
	},
	voteThread(threadId, value) {
		if (value !== 1 && value !== -1) return false
		this.db.threadVotes.set(`${threadId}/${this.from}`, { creator: this.from, threadId, value })
	},
	voteComment(commentId, value) {
		if (value !== 1 && value !== -1) return false
		this.db.commentVotes.set(`${commentId}/${this.from}`, { creator: this.from, commentId, value })
	},
}
