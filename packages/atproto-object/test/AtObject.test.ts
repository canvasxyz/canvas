import test from "ava"

import { AtObject } from "@canvas-js/atproto-object"

import entry from "./lexicons/com/whtwnd/blog/entry.json" with { type: "json" }
import post from "./lexicons/app/bsky/feed/post.json" with { type: "json" }

const replyPattern = /at:\/\/%s\/com.whtwnd.blog.entry\/%s/

type Post = DeriveType<typeof post>
type Entry = DeriveType<typeof entry>

test("AtObject can be instantiated", (t) => {
	// index all records as-is
	const WhitewindDefaultTables = new AtObject(["com.whtwnd.blog.entry", "app.bsky.feed.post"])

	// rename tables
	const WhitewindNamedTables = new AtObject([
		{ $type: "com.whtwnd.blog.entry", table: "entries" },
		{ $type: "app.bsky.feed.post", table: "posts" },
	])

	// filter records
	const WhitewindFilter = new AtObject({
		entries: "com.whtwnd.blog.entry",
		comments: {
			nsid: "app.bsky.feed.post",
			filter: (nsid: string, rkey: string, post: Post) => {
				return replyPattern.test(post.reply["at-uri"])
			},
		},
	})

	// custom handlers
	const WhitewindCustomHandler = new AtObject({
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
	})

	// app.listen("wss://bsky.network") // listen to relay, sync PDSes as they appear
})
