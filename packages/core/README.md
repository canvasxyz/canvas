# @canvas-js/core

A Canvas application replicates and executes a log of signed actions, sourced from
GossipLog, with read/write access to a ModelDB database.

Use this package directly if you want fine-grained control over when an
application is started/stopped. Otherwise, you can use `useCanvas` in
`@canvas-js/hooks`, which has the same API, but handles initialization
inside React for you.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [API](#api)

## Installation

```
$ npm i @canvas-js/core
```

## Usage

```ts
import { Canvas } from "@canvas-js/core"

const app = await Canvas.initialize({
  topic: "com.example.my-app",
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
      async createPost({ content }) {
        const { id, chain, address, timestamp } = this
        const user = [chain, address].join(":")
        await db.posts.set({ id, user, content, updated_at: timestamp })
      },
      async deletePost({ postId }) {
        const { chain, address } = this
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
//     user: 'did:pkh:eip155:1:0x79c5158f81ebb0c2bcF877E9e1813aed2Eb652B7',
//     content: 'hello world!',
//     updated_at: 1698339861041
//   }
// ]
```

## API

<<< @/../packages/core/src/types.ts
