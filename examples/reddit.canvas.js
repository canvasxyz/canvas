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
	},
	commentUpvotes: {
		commentId: "@comments",
		creator: "string",
		createdAt: "datetime",
	},
}

export const routes = {
	'/latest': `SELECT threads.*, COUNT(comments.id)
		FROM threads
			JOIN comments ON comments.threadId = threads.id
		GROUP BY threads.id
		ORDER BY threads.createdAt DESC
		LIMIT 30`,
	'/top': `SELECT
			threads.*,
			SUM(
				1 / (cast(strftime('%s','now') as float) * 1000 - threadVotes.createdAt)
			) AS score,
			group_concat(threadVotes.creator)
		FROM threads
			LEFT JOIN threadVotes ON threads.id = threadVotes.threadId
			WHERE threadVotes.createdAt > datetime('now', '-90 days')
		GROUP BY threads.id
		ORDER BY score DESC
		LIMIT 30`,
	'/threads/:threadId/comments': `SELECT
		comments.*,
		SUM(
			1 / (cast(strftime('%s','now') as float) * 1000 - commentVotes.createdAt)
		) AS score,
		group_concat(commentVotes.creator)
	FROM comments
		LEFT JOIN commentVotes ON comments.id = commentVotes.commentId
		WHERE comments.threadId = :threadId
	GROUP BY comments.id
	ORDER BY score DESC
	LIMIT 30`
}

export const actions = {
	createThread(title, link) {
		this.db.threads.create({
			creator: this.from,
			createdAt: this.timestamp,
			title,
			link,
		})
	},
	createComment(threadId, text) {
		this.db.comments.create({
			creator: this.from,
			createdAt: this.timestamp,
			threadId,
			text,
		})
	},
	voteThread(threadId, value) {
		//if (value !== 1 || value !== -1) return false
		this.db.upvotes.create({
			creator: this.from,
			createdAt: this.timestamp,
			threadId,
			//value,
		})
	},
	voteComment(commentId, value) {
		//if (value !== 1 || value !== -1) return false
		this.db.commentUpvotes.create({
			creator: this.from,
			createdAt: this.timestamp,
			commentId,
			//value,
		})
	},
}
