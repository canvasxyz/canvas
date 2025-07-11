import test from "ava"

import { AtObject, FromLexicon } from "@canvas-js/atproto-object"
import { whitewind } from "./fixtures.js"

import post from "./lexicons/app/bsky/feed/post.json" with { type: "json" }

type Post = FromLexicon<typeof post>

test("backfill whitewind users' repos", async (t) => {
    const app = await AtObject.initialize([{ $type: "com.whtwnd.blog.entry", table: "entry" }], null)

    await app.backfill(whitewind)

    const entries = await app.db.query("entry")
    t.true(entries.length > 0, "has entries")
})