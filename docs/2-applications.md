# Creating an Application

Canvas applications are configured by three values:

1. `topic`: A global string identifier for the application, e.g. `myapp.canvas.xyz`
2. `models`: A relational database schema, expressed in a concise JSON DSL documented in [canvas/packages/modeldb/README.md](https://github.com/canvasxyz/canvas/tree/main/packages/modeldb)
3. `actions`: An object of _action handler_ functions that execute each type of action

These values are collectively called a "contract" and can be provided in two ways - either inline as regular JavaScript values, or as ESM exports of a JavaScript _file_ provided as a string.

The simplest way to get started is to import `@canvas-js/core` and call `Canvas.initialize({ ... })` with an inline contract.

```ts
import { Canvas } from "@canvas-js/core"

const app = await Canvas.initialize({
	topic: "my-app.example.com",
	contract: {
		models: {
			posts: {
				id: "primary",
				user: "string",
				content: "string",
				updated_at: "integer",
			},
		},
		actions: {
			async createPost(db, { content }, { id, did, timestamp }) {
				await db.set("posts", { id, user: did, content, updated_at: timestamp })
			},
			async deletePost(db, { postId }, { did }) {
				const post = await db.get("posts", postId)
				if (post === null) {
					return
				}

				if (post.user !== did) {
					throw new Error("not authorized")
				}

				await db.delete("posts", postId)
			},
		},
	},
})

await app.actions.createPost({ content: "hello world!" })
const results = await app.db.query("posts", {})
// [
//	 {
//		 id: '09p5qn7affkhtbflscr663tet8ddeu41',
//		 user: 'did:pkh:eip155:1:0x79c5158f81ebb0c2bcF877E9e1813aed2Eb652B7',
//		 content: 'hello world!',
//		 updated_at: 1698339861041
//	 }
// ]
```

You can also maintain contracts as JavaScript or TypeScript files.

If you export `models` and `actions` from a .js or .ts file, you can
pass it as a string to `Canvas.initialize({ contract })`. Canvas will
execute it inside a QuickJS WASM VM.

## Actions

Each Canvas action is calld with a set of parameters:

- a `name`, e.g. `createPost` or `deletePost`
- an argument object `args`, e.g. `{ content: "hello world!" }`
- an user identifier `did`, e.g. a chain-agnostic [did:pkh](https://github.com/w3c-ccg/did-pkh) identifier
- a `timestamp` and optional `blockhash` (timestamps are unverified / purely informative)

```ts
type Action = {
	/** DID of the user that authorized the session (e.g. "did:pkh:eip155:1:0xb94d27...") */
	name: string
	args: any
	did: string
	context: {
		timestamp: number
		blockhash?: string
	}
}
```

Action handlers are called with a mutable database handle `db`, followed
by any arguments attached to the action `...args`.

The context object `this` contains the rest of the action metadata, e.g.
`did`, `address` which is the last part of the DID, `timestamp`, `id`
which is the message ID of the signed action, etc.

```ts
async createPost(db, { content }) {
  const { id, chain, address, did, timestamp } = this
	const user = [chain, address].join(":")
	await db.set("posts", { id: msgid, user, content, updated_at: timestamp })
}
```

Actions implement the business logic of your application: every effect must happen through an action.

Actions should handle authorization and access control. In the example's `deletePost` action handler, we have to enforce that users can only delete their own posts, and not arbitrary posts.

```ts
async function deletePost(db, { postId }, { chain, address }) {
	const post = await db.get("posts", postId)
	if (post === null) {
		return
	}

	const user = [chain, address].join(":")
	if (post.user !== user) {
		throw new Error("not authorized")
	}

	await db.delete("posts", postId)
}
```

Actions are atomic, so you can combine multiple `db.get()` or `db.set()` calls, and they will always be executed together.

When actions with `db.get()` are propagated to other machines or replayed later, the `db.get()` operation always returns the same value that it saw at the time of execution.

We achieve this by doing extra bookkeeping inside the database, and storing an automatically compacted history of the database inside the action log.
