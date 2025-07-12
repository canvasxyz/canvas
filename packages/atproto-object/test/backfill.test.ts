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
