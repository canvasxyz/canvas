import test from "ava"

import { AtObject } from "@canvas-js/atproto-object"

import entry from "./lexicons/com/whtwnd/blog/entry.json" with { type: "json" }
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
type Entry = FromLexicon<typeof entry>

test("AtObject can be instantiated", async (t) => {
	const replyPattern = /at:\/\/%s\/com.whtwnd.blog.entry\/%s/

	// index all records as-is
	const whitewind = await AtObject.initialize(["com.whtwnd.blog.entry", "app.bsky.feed.post"], null)

	// rename tables
	const whitewindNamedTables = await AtObject.initialize([
		{ $type: "com.whtwnd.blog.entry", table: "entries" },
		{ $type: "app.bsky.feed.post", table: "posts" },
	], null)

	// filter records
	const whitewindFiltered = await AtObject.initialize({
		entries: "com.whtwnd.blog.entry",
		comments: {
			nsid: "app.bsky.feed.post",
			filter: (nsid: string, rkey: string, post: Post) => {
				return replyPattern.test(post.reply["at-uri"])
			},
		},
	}, null)

	// custom handlers
	const whitewindCustomHandler = await AtObject.initialize({
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
	}, null)

	t.pass()
})

test("atobject listens to jetstream", async (t) => {
	const app = await AtObject.initialize(["app.bsky.feed.post"], null)
	app.listen("wss://jetstream1.us-east.bsky.network")

	setTimeout(() => {
		app.close()
	}, 500)
})

test("atobject listens to jetstream with named tables", async (t) => {
	const app = await AtObject.initialize([{ $type: "app.bsky.feed.post", table: "post" }], null)
	app.listen("wss://jetstream1.us-east.bsky.network")

	setTimeout(() => {
		app.close()
	}, 500)
})

test("atobject listens to jetstream with filters", async (t) => {
	const app = await AtObject.initialize({
		comments: {
			nsid: "app.bsky.feed.post",
			filter: (nsid: string, rkey: string, post: Post) => {
				// Only posts that are replies
				return post.reply != null
			},
			handler: (nsid: string, rkey: string, post: Post | null, db) => {
				if (post && post.reply) {
					console.log(`New comment on: ${post.reply.parent.uri}`)
					db.set("comments", post)
				}
			}
		}
	}, null)
	app.listen("wss://jetstream1.us-east.bsky.network")

	setTimeout(() => {
		app.close()
	}, 500)
})

test("atobject listens to jetstream with custom handlers", async (t) => {
	const app = await AtObject.initialize({
		posts: "app.bsky.feed.post",
		entries: {
			nsid: "com.whtwnd.blog.entry",
			handler: (nsid: string, rkey: string, entry: Entry | null, db) => {
				if (entry === null) {
					console.log(`Blog entry deleted: ${rkey}`)
					db.delete("entries", rkey)
				} else {
					console.log(`New blog entry: ${entry.title}`)
					db.set("entries", entry)
				}
			}
		}
	}, null)
	app.listen("wss://jetstream1.us-east.bsky.network")

	setTimeout(() => {
		app.close()
	}, 500)
})
