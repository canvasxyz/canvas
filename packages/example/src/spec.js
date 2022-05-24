const spec = {
	models: {
		threads: {
			title: "string",
		},
		likes: {
			threadId: "string",
			value: "boolean",
		},
	},
	routes: {
		"/threads":
			"SELECT threads.id, threads.title, threads.timestamp, COUNT(IIF(likes.value, 1, NULL)) as likes FROM threads LEFT JOIN likes ON likes.threadId = threads.id GROUP BY threads.id",
	},
	actions: {
		createThread: function (title) {
			if (!title || !title.trim()) throw new Error("Invalid title")
			this.db.threads.set(this.hash, { title })
		},
		like: function (threadId) {
			this.db.likes.set(this.from + threadId, { threadId, value: true })
		},
		unlike: function (threadId) {
			this.db.likes.set(this.from + threadId, { threadId, value: false })
		},
	},
}

export default spec
