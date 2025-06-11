# Creating an Application

Canvas applications are configured by three values:

1. `models`: A relational database schema, expressed in a concise JSON DSL documented in [canvas/packages/modeldb/README.md](https://github.com/canvasxyz/canvas/tree/main/packages/modeldb)
2. `actions`: Methods that execute each type of action
3. `namespace`: A namespace that the application will live under; this should be a unique name such as your domain.

These values are collectively called a "contract" and can be provided in two ways - either as a JavaScript class, or as Firebase-like models.

::: code-group

```ts [Class Contract]
import { Canvas, Contract } from "@canvas-js/core"

class Chat extends Contract<typeof Chat.models> {
  static namespace = "chat.example.xyz"

  static models = {
    posts: {
      id: "primary",
      user: "string",
      content: "string",
      updated_at: "integer",
    },
  }

  async createPost(content: string) {
    const { db, id, did, timestamp } = this
    await db.set("posts", { id, user: did, content, updated_at: timestamp })
  }

  async deletePost(postId: string) {
    const { db, did } = this
    const post = await db.get("posts", postId)
    if (post === null) {
      return
    }

    if (post.user !== did) {
      throw new Error("not authorized")
    }

    await db.delete("posts", postId)
  }
}
```

```ts [Model Contract]
const Chat = {
  namespace: "chat-db.example.xyz",
  models:
    messages: {
      id: "primary",
      content: "string",
      address: "string",
      $rules: {
        create: "address === this.address",
        update: false,
        delete: false,
      }
    }
  } satisfies ModelSchema
}
```

:::

## Starting your application

Once you've configured your application, the simplest way to start it is to call `Canvas.initialize({ ... })`:

```ts
const app = await Canvas.initialize({
  contract: Chat,
})

await app.actions.createPost("hello world!")
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

If you wish, you can maintain a separate TypeScript or JavaScript file for class contracts, that uses `export default class` to expose a class that extends `Contract`.

If you pass that contract as a string to `Canvas.initialize({ contract })`, it will be compiled using `esbuild` and initialized inside a QuickJS WASM VM. Alternatively, you can also run string contracts from the command line (see [Deploying](/6-deploying)).

## Actions

Each Canvas action is called with a set of parameters:

- a `name`, e.g. `createPost` or `deletePost`
- an argument array `args`, e.g. `['hello world!']`
- an user identifier `did`, e.g. a chain-agnostic [did:pkh](https://github.com/w3c-ccg/did-pkh) identifier
- a `timestamp` and optional `blockhash` (timestamps are unverified and purely informative)

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

Action methods are called with any arguments passed to the action `...args`.

The context object `this` contains the rest of the action metadata, including
`did`, `address` (the last component of the DID), `timestamp`, and a unique action `id`.

```ts
class Chat extends Contract<typeof Chat.models> {
  static namespace = "chat.example.xyz"

  static models = {
    posts: {
      id: "primary",
      content: "string",
      timestamp: "integer",
      address: "string",
    },
  }

  async createPost(content: string) {
    const { id, chain, address, did, timestamp } = this
    const user = [chain, address].join(":")
    await this.db.set("posts", { id, user, content, updated_at: timestamp })
  }
}
```

Actions implement the business logic of your application: every effect must happen through an action.

Actions also handle authorization and access control. In the example `deletePost` action handler, we have to enforce that users can only delete their own posts, and not arbitrary posts.

```ts
class Chat extends Contract<typeof Chat.models> {
  static namespace = "chat.example.xyz"

  static models = {
    posts: {
      id: "primary",
      content: "string",
      user: "string",
    },
  }

  async deletePost(postId: string) {
    const { chain, address } = this
    const post = await this.db.get("posts", postId)
    if (post === null) {
      return
    }

    const user = [chain, address].join(":")
    if (post.user !== user) {
      throw new Error("not authorized")
    }

    await this.db.delete("posts", postId)
  }
}
```

Every action reads a deterministic snapshot of the database. When actions that call `db.get()` are propagated to other machines or replayed later, each `db.get()` always returns the same value that it saw at the time and place it was first created.

We achieve this by doing extra bookkeeping inside the database, and maintaining a compacted history of each database record.