export const models = {
	threads: {
		title: "string",
		link: "string",
		creator: "string",
		createdAt: "datetime",
	},
	comments: {
		threadId: "@threads",
		text: "string",
		creator: "string",
		createdAt: "datetime",
	},
	threadVotes: {
		threadId: "@threads",
		creator: "string",
		createdAt: "datetime",
		value: "integer",
	},
	commentUpvotes: {
		commentId: "@comments",
		creator: "string",
		createdAt: "datetime",
		value: "integer",
	},
}

export const routes = {
	"/latest": `SELECT
            threads.*,
            SUM(
                1 / (cast(strftime('%s','now') as float) * 1000 - threadVotes.createdAt) *
                CAST(threadVotes.value as INT)
            ) AS score,
            group_concat(threadVotes.creator) as voters,
            COUNT(comments.id) as comments
        FROM threads
            LEFT JOIN comments ON comments.threadId = threads.id
            LEFT JOIN threadVotes ON threads.id = threadVotes.threadId
        GROUP BY threads.id
        ORDER BY threads.createdAt DESC
        LIMIT 30`,
	"/top": `SELECT
            threads.*,
            SUM(
                1 / (cast(strftime('%s','now') as float) * 1000 - threadVotes.createdAt) *
                CAST(threadVotes.value as INT)
            ) AS score,
            group_concat(threadVotes.creator) as voters,
            COUNT(DISTINCT comments.id) as comments
        FROM threads
            LEFT JOIN comments ON comments.threadId = threads.id
            LEFT JOIN threadVotes ON threads.id = threadVotes.threadId
        GROUP BY threads.id
        ORDER BY score DESC
        LIMIT 30`,
	"/threads/:threadId": `SELECT
            threads.*,
            SUM(
                1 / (cast(strftime('%s','now') as float) * 1000 - threadVotes.createdAt) * threadVotes.value
            ) AS score,
            COUNT(DISTINCT comments.id)
        FROM threads
            LEFT JOIN comments ON comments.threadId = threads.id
            LEFT JOIN threadVotes ON threads.id = threadVotes.threadId
            WHERE threads.id = :threadId
        GROUP BY threads.id`,
	"/threads/:threadId/comments": `SELECT
            comments.*,
            SUM(
                1 / (cast(strftime('%s','now') as float) * 1000 - commentVotes.createdAt) * commentVotes.value
            ) AS score,
            group_concat(commentVotes.creator)
        FROM comments
            LEFT JOIN commentVotes ON comments.id = commentVotes.commentId
            WHERE comments.threadId = :threadId
        GROUP BY comments.id
        ORDER BY score DESC
        LIMIT 30`,
}

export const actions = {
	thread(title, link) {
		this.db.threads.create({
			creator: this.from,
			createdAt: this.timestamp,
			title,
			link,
		})
	},
	comment(threadId, text) {
		this.db.comments.create({
			creator: this.from,
			createdAt: this.timestamp,
			threadId,
			text,
		})
	},
	voteThread(threadId, value) {
		if (value !== 1 || value !== -1) return false
		this.db.upvotes.create({
			creator: this.from,
			createdAt: this.timestamp,
			threadId,
			value,
		})
	},
	voteComment(commentId, value) {
		if (value !== 1 || value !== -1) return false
		this.db.commentUpvotes.create({
			creator: this.from,
			createdAt: this.timestamp,
			commentId,
			value,
		})
	},
}
