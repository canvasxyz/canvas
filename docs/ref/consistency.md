# Consistency Model

Canvas is a sync engine that allows you to define actions that are arbitrary JavaScript functions, which freely `get`, `set`, and `delete` records in a relational database.

The two basic guarantees that the runtime provides are:

1. the execution of every action is deterministic, and
2. peers converge to the same state as they sync.

Additionally, we provide transactions, which work in a way similar to optimistic rollback in multiplayer online games. Actions are accepted at the time they are executed, and rolled back on conflict.

In a transaction, if you read from a database record and then write to any other records, your writes will be rolled back if the record that you read was changed.

## How we achieve determinism

To guarantee determinism, we ensure that every `db.get()` returns the same value when an action is reexecuted by other peers.

This needs to be true even if they receive the action later in time, and/or have applied other concurrent actions that write to that record.

The runtime achieves this by using a virtual snapshot of the database, in which only effects from the action's causal ancestors are visible. This can also be thought of as *rewinding* to the original context which the action was executed in.

### Nondeterministic JS code

However, it is still possible to write non-deterministic JavaScript code inside an action function, with functions like `Math.random()` and `Date.now()`. These functions will break determinism and should not be used.

For generating random identifiers, you can use the `this.db.id()` function. This will generate a new hash every time it is called, and it is safe to use as a deterministic replacement for `Math.random()`.

(Like `Math.random()`, it is not cryptographically secure.)

## How we achieve convergence

To guarantee convergence, we ensure each peer resolves conflicts in a consistent way, independent of the order in which they apply concurrent actions.

To accomplish this, we treat each database row as its own last-write-wins record, using the logical clock from the [underlying causal log](/api/gossiplog) to determine precedence.

This means if if multiple users edit the same database record concurrently, the user that writes to the database with a greater action ID will overwrite the other one.

### Limitations of last-write-wins

Last-write-wins (LWW) is good default behavior that works well for many kinds of state, but has some fundamental limitations. For example, last-write-wins can partially overwite or "interleave" effects between two concurrent branches, making it impossible to maintain invariants across multiple records.

Another limitation of LWW is that a malicious user can select convenient locations in the past to branch off of, "bypassing" undesired actions that e.g. remove them from a group chat's membership list.

Last-write-wins is good for merging many logically independent operations, but it doesn't enforce any constraints between different database records - you can't enforce arbitrary constraints on global state transitions.

## Transactions

To support stronger constraints on state transitions, applications can use **transactions** within action handlers.

```ts
export const actions = {
  // ...
  async createPost(roomId: string, content: string) {
    await this.db.transaction(async () => {
      // ...
    })
  }
}
```

In a traditional database, a transaction will either succeed or reject at the time it is committed, and the application is responsible for dealing with the potential failure to commit.

In our system, this is reversed: transactions are actually guaranteed to succeed initially, but might be subsequently **reverted** due to a conflict with other transactions received later. Applications must be designed to handle these retroactive reverts, but can still rely on transaction atomicity and serializability.

Inside a transaction callback, all writes within a transaction are treated atomically - if there is a write conflict between two concurrent transactions, then one will be reverted, and none of its writes will be visible to subsequent `db.get` reads. Furthermore, transactions conflict when one reads a record that is concurrently written by another, preventing actions from "bypassing" effects on another branch and enforcing a serializable consistency on a per-record basis.

### Example contract using transactions

Here's a complete example contract that uses transactions to enforce group chat membership.

It implements the policy that if a user is removed from a group chat, their messages will be removed, by rolling back their message creation action.

```ts
export const models = {
  members: { key: "primary", admin: "boolean" },
  posts: {
    id: "primary",
    roomId: "string",
    userId: "string",
    content: "string",
  },
}

export const actions = {
  async addMember(roomId: string, userId: string, admin: boolean) {
    await this.db.transaction(async () => {
      const selfMembershipKey = [roomId, this.did].join("/")
      const selfMembership = await this.db.get("membership", selfMembershipKey)
      assert(selfMembership !== null && selfMembership.admin)

      const userMembershipKey = [roomId, userId].join("/")
      await this.db.set("membership", { key: userMembershipKey, admin })
    })
  }
  async removeMember(roomId: string, userId: string) {
    await this.db.transaction(async () => {
      const selfMembershipKey = [roomId, this.did].join("/")
      const selfMembership = await this.db.get("membership", selfMembershipKey)
      assert(selfMembership !== null && selfMembership.admin)

      const userMembershipKey = [roomId, userId].join("/")
      await this.db.delete("membership", userMembershipKey)
    })
  }
  async createPost(roomId: string, content: string) {
    await this.db.transaction(async () => {
      const membershipKey = [roomId, this.did].join("/")
      const membership = await this.db.get("membership", membershipKey)
      assert(membership !== null)

      await this.db.set("posts", { postId: this.id, roomId, userId: this.did, content })
    })
  }
}
```

Here are some of the more detailed cases worth considering:

- Any number of concurrent `createPost` actions can still be published by group members without conflict.
- If a user tries to publish a `createPost` action concurrently to a `removeMember` action that removes them from the group, this will cause a read conflict on the membership record. The write (`removeMember`) will take precedence over the read (`createPost`), and the `createPost` transaction will be reverted.
- If two concurrent `addMember` actions try to add the same user to the same room (maybe with conflicting `admin` roles), this will cause a write conflict, and one will be reverted. Any `createPost` actions building on the reverted branch will be reverted as well, since transactional reads form "read dependencies" that recursively propagate reverts.

### Transaction revert conditions

To summarize, a transaction can be reverted for three reasons:

1. a _write conflict_ with a concurrent transaction (both transactions write to the same record)
2. a _read conflict_ with a concurrent transaction (one transaction reads from a record that the other writes to)
3. a _read dependency_ on a past transaction that is reverted (a reverted transaction recursively reverts to any subsequent transactions that read any of its values)

The revert status of a specific transaction is a subjective property - it depends on where in history we are looking at the transaction from. However, revert status is guaranteed to be monotonic - transactions only transition from not reverted to reverted as new messages are received, and never back to not reverted again.

## Limitations

Also important to note is that inside a transaction, `db.get` will only return values written by past transactions, and not any LWW values set outside a transaction callback.

However, non-transactional LWW reads will see all past values, both inside and outside transactions.

In general, for any value, you should either always write to it from inside a transaction, or always use LWW writes, and never mix.
