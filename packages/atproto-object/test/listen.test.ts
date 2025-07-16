import test from "ava"

import { AtObject, FromLexicon, ModelAPI } from "@canvas-js/atproto-object"

import post from "./lexicons/app/bsky/feed/post.json" with { type: "json" }

type Post = FromLexicon<typeof post>

const firehoseUrl = "wss://bsky.network"

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
				filter: (post: Post, creator: string, rkey: string) => {
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
				filter: (post: Post, creator: string, rkey: string) => {
					return replyPattern.test(post.reply["at-uri"])
				},
				handler: (db: ModelAPI, post: Post | null, creator: string, rkey: string) => {
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

test("listen to relay", async (t) => {
	const app = await AtObject.initialize(["app.bsky.feed.post"], null)
	app.listen(firehoseUrl)

	t.teardown(() => app.close())
	while (!app.lastSeq) {
		await new Promise((resolve) => setTimeout(resolve, 1000))
	}

	const posts = await app.db.query("app.bsky.feed.post")
	t.true(posts.length > 0)
})

test("listen with named tables", async (t) => {
	const app = await AtObject.initialize([{ $type: "app.bsky.feed.post", table: "post" }], null)
	app.listen(firehoseUrl)

	t.teardown(() => app.close())
	while (!app.lastSeq) {
		await new Promise((resolve) => setTimeout(resolve, 1000))
	}

	const posts = await app.db.query("post")
	t.true(posts.length > 0)
})

test("listen with filters", async (t) => {
	let seenComment = false

	const app = await AtObject.initialize(
		{
			comments: {
				nsid: "app.bsky.feed.post",
				filter: (post: Post, creator: string, rkey: string) => {
					seenComment = post.reply && post.reply.parent && post.reply.root
					return seenComment
				},
			},
		},
		null,
	)
	app.listen(firehoseUrl)

	t.teardown(() => app.close())
	while (!seenComment) {
		await new Promise((resolve) => setTimeout(resolve, 1000))
	}

	const posts = await app.db.query("comments")

	t.true(posts.length > 0, "has comments")
	t.true(
		posts.every(({ record }) => record.reply !== undefined),
		"has only comments",
	)
})

test("listen with custom handlers", async (t) => {
	let seenPost = false

	const app = await AtObject.initialize(
		{
			posts: {
				nsid: "app.bsky.feed.post",
				handler: async (db: ModelAPI, post: Post, creator: string, rkey: string) => {
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
	app.listen(firehoseUrl)

	t.teardown(() => app.close())
	while (!seenPost) {
		await new Promise((resolve) => setTimeout(resolve, 1000))
	}

	const posts = await app.db.query("posts")

	t.true(posts.length > 0, "has posts")
	t.true(
		posts.every(({ record }) => record.text.indexOf("e") === -1),
		"has only posts without the letter 'e'",
	)
})

test("listen with cursor and predicate", async (t) => {
	let seenPost = false

	const app1 = await AtObject.initialize(
		{
			posts: {
				nsid: "app.bsky.feed.post",
				handler: async function (db: ModelAPI, post: Post, creator: string, rkey: string) {
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
	app1.listen(firehoseUrl)
	t.teardown(() => app1.close())

	while (!seenPost) {
		await new Promise<void>((resolve) => setTimeout(resolve, 1000))
	}
	await new Promise<void>((resolve) => setTimeout(resolve, 100))

	const firstPosts = await app1.db.query("posts")
	await app1.close()

	t.true(firstPosts.length > 0, "has posts")
	t.assert(app1.firstSeq !== null)
	t.assert(app1.lastSeq !== null)

	//
	// Reindex starting from app1's cursor, and ensure we see the same posts.
	//
	const app2 = await AtObject.initialize(
		{
			posts: {
				nsid: "app.bsky.feed.post",
			},
		},
		null,
	)
	t.teardown(() => app2.close())

	app2.backfill(firehoseUrl, app1.firstSeq!.toString())
	while (!app2.lastSeq || app2.lastSeq < app1.lastSeq!) {
		await new Promise<void>((resolve) => setTimeout(resolve, 1000))
	}
	await new Promise<void>((resolve) => setTimeout(resolve, 100))

	const secondPosts = await app2.db.query("posts")
	await app2.close()

	t.assert(secondPosts.length >= firstPosts.length, "second session should have at least as many posts as first")
	const firstPostKeys = new Set(firstPosts.map((p) => p.rkey))
	const secondPostKeys = new Set(secondPosts.map((p) => p.rkey))
	for (const rkey of firstPostKeys) {
		t.assert(secondPostKeys.has(rkey), `post with rkey ${rkey} should be replayed in second session`)
	}

	//
	// Reindex starting from app1's cursor, only accepting posts from users that appeared in our first listen.
	//
	const app3 = await AtObject.initialize(
		{
			// TODO: Better way to declare tables.
			wantedRkeys: {
				nsid: "foo.foo.foo.foo",
			},
			posts: {
				predicate: { $rkey: ["wantedRkeys"] },
				nsid: "app.bsky.feed.post",
			},
		},
		null,
	)
	t.teardown(() => app3.close())

	for (const p of firstPosts) {
		await app3.db.set("wantedRkeys", { rkey: p.rkey, record: "foo" })
	}

	app3.backfill(firehoseUrl, app1.firstSeq!.toString())

	while (!app3.lastSeq || app3.lastSeq < app1.lastSeq!) {
		await new Promise<void>((resolve) => setTimeout(resolve, 1000))
	}
	await new Promise<void>((resolve) => setTimeout(resolve, 100))

	const thirdPosts = await app3.db.query("posts")
	await app3.close()

	const thirdPostKeys = new Set(thirdPosts.map((p) => p.rkey))
	t.assert(thirdPosts.length === firstPosts.length, "backfill with predicate should yield same posts as first backfill")
})
