import test from "ava"

import { AtObject } from "@canvas-js/atproto-object"

import post from "./lexicons/app/bsky/feed/post.json" with { type: "json" }

type FromLexicon<T> = T extends {
	defs: { main: { record: { properties: infer P; required?: infer Required extends string[] } } }
}
	? {
			[K in keyof P as K extends Required[number] ? K : never]: any
		} & {
			[K in keyof P as K extends Required[number] ? never : K]?: any
		}
	: any

type Post = FromLexicon<typeof post>

test("create AtObject instances", async (t) => {
	const replyPattern = /at:\/\/%s\/com.whtwnd.blog.entry\/%s/

	// index all records as-is
	const whitewind = await AtObject.initialize(["com.whtwnd.blog.entry", "app.bsky.feed.post"], null)

	// rename tables
	const whitewindNamedTables = await AtObject.initialize(
		[
			{ $type: "com.whtwnd.blog.entry", table: "entries" },
			{ $type: "app.bsky.feed.post", table: "posts" },
		],
		null,
	)

	// filter records
	const whitewindFiltered = await AtObject.initialize(
		{
			entries: "com.whtwnd.blog.entry",
			comments: {
				nsid: "app.bsky.feed.post",
				filter: (nsid: string, rkey: string, post: Post) => {
					return replyPattern.test(post.reply["at-uri"])
				},
			},
		},
		null,
	)

	// custom handlers
	const whitewindCustomHandler = await AtObject.initialize(
		{
			entries: "com.whtwnd.blog.entry",
			comments: {
				nsid: "app.bsky.feed.post",
				filter: (nsid: string, rkey: string, post: Post) => {
					return replyPattern.test(post.reply["at-uri"])
				},
				handler: (nsid: string, rkey: string, post: Post | null, db) => {
					if (post === null) {
						db.delete("comments", rkey)
						// ... other custom indexing
					} else {
						db.set("comments", post)
						// ... clean up other custom indexing
					}
				},
			},
		},
		null,
	)

	t.pass()
})

test("listen to jetstream", async (t) => {
	const app = await AtObject.initialize(["app.bsky.feed.post"], null)
	app.listen("wss://jetstream1.us-east.bsky.network")

	t.teardown(() => app.close())
	await new Promise((resolve) => setTimeout(resolve, 500))

	const posts = await app.db.query("app.bsky.feed.post")
	t.true(posts.length > 0)
})

test("listen to jetstream with named tables", async (t) => {
	const app = await AtObject.initialize([{ $type: "app.bsky.feed.post", table: "post" }], null)
	app.listen("wss://jetstream1.us-east.bsky.network")

	t.teardown(() => app.close())
	await new Promise((resolve) => setTimeout(resolve, 500))

	const posts = await app.db.query("post")
	t.true(posts.length > 0)
})

test("listen to jetstream with filters", async (t) => {
	let seenComment = false

	const app = await AtObject.initialize(
		{
			comments: {
				nsid: "app.bsky.feed.post",
				filter: (nsid: string, rkey: string, post: Post) => {
					seenComment = post.reply && post.reply.parent && post.reply.root
					return seenComment
				},
			},
		},
		null,
	)
	app.listen("wss://jetstream1.us-east.bsky.network")

	t.teardown(() => app.close())
	while (!seenComment) {
		await new Promise((resolve) => setTimeout(resolve, 500))
	}

	const posts = await app.db.query("comments")

	t.true(posts.length > 0, "has comments")
	t.true(
		posts.every(({ record }) => record.reply !== undefined),
		"has only comments",
	)
})

test("listen to jetstream with custom handlers", async (t) => {
	let seenPost = false

	const app = await AtObject.initialize(
		{
			posts: {
				nsid: "app.bsky.feed.post",
				handler: async (nsid: string, rkey: string, post: Post, db) => {
					if (post === null) {
						await db.delete("posts", rkey)
					} else {
						if (post.text.indexOf("e") !== -1) return
						seenPost = true
						await db.set("posts", { rkey, record: post })
					}
				},
			},
		},
		null,
	)
	app.listen("wss://jetstream1.us-east.bsky.network")

	t.teardown(() => app.close())
	while (!seenPost) {
		await new Promise((resolve) => setTimeout(resolve, 500))
	}

	const posts = await app.db.query("posts")

	t.true(posts.length > 0, "has posts")
	t.true(
		posts.every(({ record }) => record.text.indexOf("e") === -1),
		"has only posts without the letter 'e'",
	)
})
