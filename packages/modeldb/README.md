# @canvas-js/modeldb

ModelDB

- Relational
- Simple JSON schema
- Dual SQLite and IndexdDB backends
- **Designed for p2p conlict resolution**
- "Mutable" vs "immutable" models

```ts
const db = await ModelDB.init({
	posts: {
		$type: "mutable",
		content: "string",
		author: "@profile",
		$indexes: ["author"],
	},
	replies: {
		// ...
	},
	profile: {
		username: "string",
		avatar: "string?",
	},
})

// joelId: `${actionHash}/${recordHash}`
const joelId = db.profile.add({ username: "joel", avatar: null })
db.profile.remove(joelId)

db.posts.set("some primary key", { content: "hi", author: joelId })
db.posts.set("some primary key", { content: "hi (edited)", author: joelId })
db.posts.delete("some primary key")


db.profile.get<T>(key: string): T  | null
db.posts.get<T>(key: string): T | null

const app = await Canvas.init({ spec: `...` })

app.db.posts.get<T>(key: string): T | null
app.db.posts.iterate<T>(): AsyncIterable<T>
app.db.queryRaw(`SELECT * FROM ... WHERE ... fjdkslafjdsklajfkldsajfkldsa jfkdlsaf`): sqlite3.Statement

const db = new ModelDB({
	users: {
		signingPublicKey: "bytes",
		encryptionPublicKey: "bytes",
	},
	rooms: {
    avatar: "string?",
    creator: "@user",
		members: "@users[]",
		$indexes: ["members"],
	},
	messages: {},
})

db.rooms.get(key, { users: { signingPublicKey: true, encryptionPublicKey: true } })

const rooms = db.rooms.query({
  select: {
    avatar: true,
    users: {
      signingPublicKey: true,
      encryptionPublicKey: true,
    }
  },
  where: {
    creator: "value",
  },

  orderBy: { [property]: "asc" | "desc" },
  limit: 19,
})

declare const rooms: {
  avatar: string | null;
  users: {
    signingPublicKey: Uint8Array
    encryptionPublicKey: Uint8Array
  }[]
}[]
```
