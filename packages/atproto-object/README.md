# @canvas-js/atproto-object

AT Protocol object utilities.

## Installation

```bash
npm install @canvas-js/atproto-object
```

## Usage

```ts
import { AtObject } from "@canvas-js/atproto-object"

const app = await AtObject.initialize(["app.bsky.feed.post"], null)

app.listen("wss://bsky.network")

app.close()
```

### Listen to a relay

```ts
app.listen("wss://bsky.network", {
  onConnect: () => console.log("Connected to firehose"),
  onDisconnect: () => console.log("Disconnected from firehose"),
  onError: (error) => console.error("Firehose error:", error)
})
```

### Backfill from a relay (limited to ~12h of history)

```ts
const cursor = "123456789"
await app.backfill("wss://bsky.network", cursor, {
  onConnect: () => console.log("Started backfill"),
  onDisconnect: () => console.log("Backfill complete")
})
```

### Backfill from PDSes

```ts
const users = ["alice.bsky.social", "bob.bsky.social", "did:plc:example"]
await app.backfillUsers(users)
```

## Initialization

### Simple Collections
```ts
// Track multiple collections
const app = await AtObject.initialize([
  "com.whtwnd.blog.entry",
  "app.bsky.feed.post"
], null)
```

### Named Tables
```ts
// Rename tables for collections
const app = await AtObject.initialize([
  { $type: "com.whtwnd.blog.entry", table: "entries" },
  { $type: "app.bsky.feed.post", table: "posts" }
], null)
```

### Filters
```ts
const app = await AtObject.initialize({
  entries: "com.whtwnd.blog.entry",
  comments: {
    nsid: "app.bsky.feed.post",
    filter: (creator: string, rkey: string, post: Post) => {
      // Only index posts that are replies
      return post.reply && post.reply.parent && post.reply.root
    }
  }
}, null)
```

### Custom Handlers
```ts
const app = await AtObject.initialize({
  posts: {
    nsid: "app.bsky.feed.post",
    handler: async (creator: string, rkey: string, post: Post | null, db) => {
      if (post === null) {
        // Handle deletion
        await db.delete("posts", rkey)
      } else {
        // Custom processing
        if (post.text.includes("canvas")) {
          await db.set("posts", { rkey, record: post })
        }
      }
    }
  }
}, null)
```

## Database Setup

```ts
// sqlite
const app = await AtObject.initialize(collections, "./data.db")

// postgres
const app2 = await AtObject.initialize(collections, "postgres://user:pass@localhost/db")

// in-memory sqlite
const app3 = await AtObject.initialize(collections, null)
```

## Database Querying

```ts
// Query all records from a table
const posts = await app.db.query("posts")

// Get specific record
const post = await app.db.get("posts", "specific-rkey")

// Delete record
await app.db.delete("posts", "rkey-to-delete")
```
