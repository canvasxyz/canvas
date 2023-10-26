# Actions

Canvas apps consist of an _action log_ and a _model database_. Each action in the log has:

- a `name` (`createPost` or `deletePost` in the example)
- an argument object `args` (`{ content: "hello world!" }`)
- an authenticated user identity `chain` + `address` using the [CAIP-2](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md) standard format
- a `timestamp` and an optional `blockhash` (timestamps are unverified / purely informative)

```ts
type Action = {
  /** CAIP-2 prefix, e.g. "eip155:1" */
  chain: string
  /** CAIP-2 address (without the prefix, e.g. "0xb94d27...") */
  address: string

  name: string
  args: any

  timestamp: number
  blockhash: string | null
}
```

Every action is executed by its corresponding action handler in the contract's `actions` object. The action handlers are invoked with a mutable database handle `db`, the action's `args`, and a context object with the rest of the action metadata.

The database can be read and queried at any time, but can only be mutated from inside an action handler executing an action. Actions implement the business logic of your application: every effect must happen through an action, although actions can have many effects and will be applied in a single atomic transaction.

Actions must also handle authorization and access control. In the example's `deletePost` action handler, we have to enforce that users can only delete their own posts, and not arbitrary posts.

```ts
async function deletePost(db, { postId }, { chain, address }) {
  const post = await db.posts.get(postId)
  if (post === null) {
    return
  }

  const user = [chain, address].join(":")
  if (post.user !== user) {
    throw new Error("not authorized")
  }

  await db.posts.delete(postId)
}
```
