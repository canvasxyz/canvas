# @canvas-js/core

This package exports a `Canvas` class that can be used to manually
instantiate Canvas applications.

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

## How it works

Under the hood, each `Canvas` application replicates and executes a
log of signed actions, sourced from GossipLog, with read/write access
to a ModelDB database.

Each application accepts several arguments:

- `contract` takes a class that extends `Contract`, or a string containing a JS module which exports a default class that extends `Contract`.
- `topic` takes a string
- `snapshot` (optional) takes a `Snapshot` object which provides initial database contents for the application.
- `signers` (optional) takes an array of signers, which allows different auth methods to be added to the application.

Use `await Canvas.initialize` to start the application. (For synchronous initialization, see CanvasLoadable.ts.)

To connect the application to other sync peers, use `app.connect()` to
start a WebSocket connection, or `app.listen()` to listen for
WebSocket connections from the server.

Or, use `app.startLibp2p()` to start a libp2p node.

After starting the application, you can use `app.actions` to access
each of the actions that you have defined.

Action calls will be signed and proxied to the contract.

```ts
import { Canvas, Contract } from "@canvas-js/core"

class Chat extends Contract<typeof Chat.models> {
  static models = {
    posts: {
      id: "primary",
      user: "string",
      content: "string",
      updated_at: "integer",
    },
  }

  async createPost(content: string) {
    const { id, chain, address, timestamp, db } = this
    const user = [chain, address].join(":")
    await db.set("posts", { id, user, content, updated_at: timestamp })
  }

  async deletePost(postId: string) {
    const { chain, address, db } = this
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
}

const app = await Canvas.initialize({
  topic: "example.xyz",
  contract: Chat,
})

await app.actions.createPost("hello world!")
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