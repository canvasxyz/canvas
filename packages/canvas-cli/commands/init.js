import fs from "fs"
import path from "node:path"

export const command = "init <spec>"
export const desc = "Create a sample spec for demonstration purposes"

export const builder = (yargs) => {
	yargs.positional("spec", {
		describe: "Path to spec file to create",
		type: "string",
		demandOption: true,
	})
}

export async function handler(args) {
	if (fs.existsSync(args.spec)) {
		console.log("File already exists, refusing to overwrite")
		return
	}

	const content = `
const models = {
	threads: {
		title: "string",
	},
	likes: {
		threadId: "string",
		value: "boolean",
	},
}

const routes = {
	"/threads":
		"SELECT threads.id, threads.title, threads.timestamp, COUNT(IIF(likes.value, 1, NULL)) as likes FROM threads LEFT JOIN likes ON likes.threadId = threads.id GROUP BY threads.id",
}

const actions = {
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
}

export { models, routes, actions }
`
	fs.writeFileSync(args.spec, content.trim())
	console.log(`Created sample spec at ${args.spec}`)
}
