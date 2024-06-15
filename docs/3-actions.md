# Actions

Canvas apps consist of an **action log** and **model database**. Each action in the log has:

- a `name`, e.g. `createPost` or `deletePost`
- an argument object `args`, e.g. `{ content: "hello world!" }`
- an authenticated user identifier `address` in either [DID](https://w3c-ccg.github.io/did-primer) or [CAIP-2](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md) format
- a `timestamp` and optional `blockhash` (timestamps are unverified / purely informative)

```ts
type Action = {
  /** DID or CAIP-2 address (e.g. "did:pkh:eip155:1:0xb94d27...") */
  did: string

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

Actions are atomic transactions, so you can combine multiple `db.get()` or `db.set()` calls, and they will always be executed together.

When actions with `db.get()` are propagated to other machines or replayed later, the `db.get()` operation always returns the same value that it saw at the time of execution.

We achieve this by doing extra bookkeeping inside the database, and storing an automatically compacted history of the database inside the action log.
