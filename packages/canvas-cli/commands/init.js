import fs from "fs"

export const command = "init <filename>"
export const desc = "Create a sample spec for demonstration purposes"

export const builder = (yargs) => {
	yargs.positional("filename", {
		describe: "Path to spec file to create",
		type: "string",
		demandOption: true,
	})
}

export async function handler(args) {
	if (fs.existsSync(args.filename)) {
		console.log("File already exists, refusing to overwrite")
		return
	}

	const content = `
export const models = {
	posts: {
		content: "string",
		from_id: "string",
	},
	likes: {
		post_id: "string",
		value: "boolean",
	},
}

export const routes = {
	"/posts":
		"SELECT posts.id, posts.from_id, posts.content, posts.updated_at, COUNT(IIF(likes.value, 1, NULL)) as likes FROM posts LEFT JOIN likes ON likes.post_id = posts.id GROUP BY posts.id ORDER BY posts.updated_at DESC LIMIT 50",
}

export const actions = {
	createPost(content) {
		this.db.posts.set(this.hash, { content, from_id: this.from })
	},
	like(postId) {
		this.db.likes.set(\`${this.from}/${postId}\`, { post_id: postId, value: true })
	},
	unlike(postId) {
		this.db.likes.set(\`${this.from}/${postId}\`, { post_id: postId, value: false })
	},
}
`
	fs.writeFileSync(args.filename, content.trim())
	console.log(`Created sample spec at ${args.filename}`)
}
