import test from "ava"

import { AtObject } from "@canvas-js/atproto-object"
import { whitewind } from "./fixtures.js"

const firehoseUrl = "wss://bsky.network"

test("backfill repos by user", async (t) => {
	const app = await AtObject.initialize([{ $type: "com.whtwnd.blog.entry", table: "entry" }], null)

	await app.backfillUsers(whitewind)
	t.teardown(() => app.close())

	const entries = await app.db.query("entry")
	t.true(entries.length > 0, "has entries")
})

test("backfill repos by user, with a handler", async (t) => {
	const app = await AtObject.initialize(
		{
			entries: {
				nsid: "com.whtwnd.blog.entry",
				handler: (creator: string, rkey: string, record: any, db: any) => {
					db.set("entries", { rkey, record })
				},
			},
		},
		null,
	)

	await app.backfillUsers(whitewind)
	t.teardown(() => app.close())

	const entries = await app.db.query("entry")
	t.true(entries.length > 0, "has entries")
})

test("backfill with firehose", async (t) => {
	const app = await AtObject.initialize([{ $type: "app.bsky.feed.post", table: "posts" }], null)

	await app.backfill(firehoseUrl, -1000)
	t.teardown(() => app.close())

	const posts = await app.db.query("posts")
	t.true(posts.length > 0, "has posts")
})
