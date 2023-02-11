import fs from "node:fs"

import yargs from "yargs"

export const command = "init <filename>"
export const desc = "Create a sample spec for demonstration purposes"

export const builder = (yargs: yargs.Argv) =>
	yargs.positional("filename", {
		describe: "Path to spec file to create",
		type: "string",
		demandOption: true,
	})

type Args = ReturnType<typeof builder> extends yargs.Argv<infer T> ? T : never

export async function handler(args: Args) {
	if (fs.existsSync(args.filename)) {
		console.log("File already exists, refusing to overwrite")
		return
	}

	const content = `// This is an example Canvas spec that implements a simple chat application.
// Try running it using \`canvas run --unchecked\` to get started.

export const models = {
	posts: {
		id: "string",
		content: "string",
		from_id: "string",
		updated_at: "datetime",
	},
	likes: {
		id: "string",
		post_id: "string",
		value: "boolean",
		updated_at: "datetime",
	},
}

export const routes = {
	"/posts": ({ offset = 0 }, { db }) => db.queryRaw("SELECT posts.id, posts.from_id, posts.content, posts.updated_at, COUNT(IIF(likes.value, 1, NULL)) as likes FROM posts LEFT JOIN likes ON likes.post_id = posts.id GROUP BY posts.id ORDER BY posts.updated_at DESC LIMIT 50 OFFSET :offset", { offset })
}

export const actions = {
	createPost(content) {
		this.db.posts.set(this.hash, { content, from_id: this.from })
	},
	like(postId) {
		this.db.likes.set(\`$\{this.from}/$\{postId}\`, { post_id: postId, value: true })
	},
	unlike(postId) {
		this.db.likes.set(\`$\{this.from}/$\{postId}\`, { post_id: postId, value: false })
	},
}
`
	fs.writeFileSync(args.filename, content)
	console.log(`Created sample spec at ${args.filename}.`)
	console.log(`Try \`canvas run --unchecked ${args.filename}\` to get started!`)
}
