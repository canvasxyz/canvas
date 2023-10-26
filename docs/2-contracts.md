# Contracts

Canvas apps are configured by three values:

1. `topic`: A global string identifier for the application
2. `models`: A relational database schema, expressed in a concise JSON DSL documented in [canvas/packages/modeldb/README.md](https://github.com/canvasxyz/canvas/tree/main/packages/modeldb)
3. `actions`: An object of _action handler_ functions that execute each type of action

These values are collectively called a "contract" and can be provided in two ways - either inline as regular JavaScript values, or as ESM exports of a JavaScript _file_ provided as a string.

The simplest way to get started is to import `@canvas-js/core` and call `Canvas.initialize({ ... })` with an inline contract.

```ts
import { Canvas } from "@canvas-js/core"

const app = await Canvas.initialize({
  contract: {
    topic: "com.example.my-app",
    models: {
      posts: {
        id: "primary",
        user: "string",
        content: "string",
        updated_at: "integer",
      },
    },
    actions: {
      async createPost(db, { content }, { id, chain, address, timestamp }) {
        const user = [chain, address].join(":")
        await db.posts.set({ id, user, content, updated_at: timestamp })
      },
      async deletePost(db, { postId }, { chain, address }) {
        const post = await db.posts.get(postId)
        if (post === null) {
          return
        }

        const user = [chain, address].join(":")
        if (post.user !== user) {
          throw new Error("not authorized")
        }

        await db.posts.delete(postId)
      },
    },
  },
})

await app.actions.createPost({ content: "hello world!" })
const results = await app.db.query("posts", {})
// [
//   {
//     id: '09p5qn7affkhtbflscr663tet8ddeu41',
//     user: 'eip155:1:0x79c5158f81ebb0c2bcF877E9e1813aed2Eb652B7',
//     content: 'hello world!',
//     updated_at: 1698339861041
//   }
// ]
```

You can also maintain contracts as separate JavaScript files.

```ts
const contract = `
export const topic = "com.example.my-app"

export const models = {
  posts: {
    id: "primary",
    user: "string",
    content: "string",
    updated_at: "integer",
  },
}

export const actions = {
  async createPost(db, { content }, { id, chain, address, timestamp }) {
    const user = [chain, address].join(":")
    await db.posts.set({ id, user, content, updated_at: timestamp })
  },
  async deletePost(db, { postId }, { chain, address }) {
    const post = await db.posts.get(postId)
    if (post === null) {
      return
    }

    const user = [chain, address].join(":")
    if (post.user !== user) {
      throw new Error("not authorized")
    }

    await db.posts.delete(postId)
  },
}
`

const app = await Canvas.initialize({ contract })
```

In this example, Canvas will execute the JavaScript contract inside a QuickJS WASM VM.
