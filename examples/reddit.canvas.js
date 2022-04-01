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
            LEFT JOIN threadVotes ON threads.key = threadVotes.threadId
        GROUP BY threads.key
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
            LEFT JOIN threadVotes ON threads.key = threadVotes.threadId
        GROUP BY threads.key
        ORDER BY score DESC
        LIMIT 30`,
	"/threads/:threadId": `SELECT
            threads.*,
            SUM(
                1 / (cast(strftime('%s','now') as float) * 1000 - threadVotes.timestamp) * threadVotes.value
            ) AS score,
            group_concat(threadVotes.creator) as voters
        FROM threads
            LEFT JOIN comments ON comments.threadId = threads.key
            LEFT JOIN threadVotes ON threads.key = threadVotes.threadId
            WHERE threads.key = :threadId
        GROUP BY threads.key`,
	"/threads/:threadId/comments": `SELECT
            comments.*,
            SUM(
                1 / (cast(strftime('%s','now') as float) * 1000 - commentVotes.timestamp) * commentVotes.value
            ) AS score,
            group_concat(commentVotes.creator) as voters
        FROM comments
            LEFT JOIN commentVotes ON comments.key = commentVotes.commentId
            WHERE comments.threadId = :threadId
        GROUP BY comments.key
        ORDER BY score DESC
        LIMIT 30`,
}

export const actions = {
	thread(key, title, link) {
		this.db.threads.set(key, { creator: this.from, title, link })
	},
	comment(key, threadId, text) {
		this.db.comments.set(key, { creator: this.from, threadId, text })
	},
	voteThread(threadId, value) {
		if (value !== 1 && value !== -1) return false
		this.db.threadVotes.set(key, { creator: this.from, threadId, value })
	},
	voteComment(commentId, value) {
		if (value !== 1 && value !== -1) return false
		this.db.commentVotes.set(key, { creator: this.from, commentId, value })
	},
}
