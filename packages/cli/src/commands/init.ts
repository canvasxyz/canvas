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

	const content = `// A Canvas backend for a simple chat application.
// Try running it using \`canvas run --unchecked\` to get started.

export const models = {
  posts: {
    id: "string",
    content: "string",
    from_id: "string",
    updated_at: "datetime",
    indexes: ["updated_at"],
  },
};

export const routes = {
  "/posts": ({ offset = 0 }, { db }) =>
    db.queryRaw("SELECT * FROM posts ORDER BY posts.updated_at DESC LIMIT 50 OFFSET :offset", { offset })
}

export const actions = {
  createPost({ content }, { db, hash, from, timestamp }) {
    db.posts.set(hash, { content, from_id: from });
  },
};`

	fs.writeFileSync(args.filename, content)
	console.log(`Created sample application at ${args.filename}.`)
	console.log(`Try \`canvas run --unchecked ${args.filename}\` to get started!`)
}
