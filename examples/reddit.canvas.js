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
	upvotes: {
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
	// 	"/latest":
	// 		"SELECT * FROM threads ORDER BY createdAt DESC OFFSET :offset LIMIT 30",
	// 	"/top": `
	// SELECT threads.*, SUM(MIN(1, 1 / (julianday('now') - julianday(upvotes.created)))) as score, group_concat(upvotes.creator)
	// FROM threads JOIN upvotes ON thread.id = upvotes.threadId
	// WHERE votes.createdAt > NOW() - 90
	// ORDER BY score OFFSET :offset LIMIT 30
	// `,
	// 	"/:id/comments": `SELECT comments.*, COUNT(commentUpvotes), group_concat(commentUpvotes.creator) as upvotes FROM comments
	// JOIN commentUpvotes ON comments.id=commentUpvotes.commentId
	// ORDER BY upvotes DESC
	// OFFSET :offset
	// LIMIT 30`,
}

export const actions = {
	createThread: {
		args: { title: "string", link: "string" },
		handler({ db }, { from, timestamp, args: { title, link } }) {
			db.threads({ creator: from, createdAt: timestamp, title, link })
		},
	},
	createComment: {
		args: { threadId: "@threads", text: "string" },
		handler({ db }, { from, timestamp, args: { threadId, text } }) {
			db.comments({ creator: from, createdAt: timestamp, threadId, text })
		},
	},
	upvote: {
		args: { threadId: "@threads" },
		handler({ db }, { from, timestamp, args: { threadId } }) {
			db.upvotes({ creator: from, createdAt: timestamp, threadId })
		},
	},
	upvoteComment: {
		args: { commentId: "@comments" },
		handler({ db }, { from, timestamp, args: { commentId } }) {
			db.commentUpvotes({ creator: from, createdAt: timestamp, commentId })
		},
	},
}
