# Consistency Model

The two basic guarantees that the Canvas runtime provides are

1. the execution of every action is deterministic, and
2. peers converge to the same state as they sync.

Canvas differs from other eventually consistent sync engines in that actions are arbitrary JavaScript functions that can freely `get`, `set`, and `delete` records in a relational database.

## Determinism

In order to guarantee determinism, every `get` needs to return the same value when applied by every peer, even if other peers have already applied other concurrent actions that write to that record. The Canvas runtime executes actions with a virtual snapshot of the database, in which only effects from the action's causal ancestors are visible.

## Convergence

To guarantee convergence, each peer needs to resolve conflicts in the same way, independent of the order in which they apply concurrent actions. By default, Canvas treats each database row as its own last-write-wins record, using the logical clock from the [underlying causal log](/readme-gossiplog) to determine precedence.

## Limitations of last-write-wins

Last-write-wins (LWW) is good default behavior that works well for many kinds of state, but has some fundamental limitations. For example, last-write-wins can partially overwite or "interleave" effects between two concurrent branches, making it impossible to maintain invariants across multiple records.

Another limitation of LWW is that a malicious user could select convenient locations in the past to branch off of, "bypassing" undesired actions that e.g. remove them from a group chat's membership list. Last-write-wins is good for merging a big union of logically monotonic effects, but using it means you can't enforce arbitrary constraints on global state transitions.

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

In a traditional database, a transaction will either succeed or reject at the time it is committed, and the application is responsible for dealing with the potential failure to commit. With Canvas, this is reversed: transactions are actually guaranteed to succeed initially, but might be subsequently **reverted** due to a conflict with other transactions received later. Applications must be designed to handle these retroactive reverts, but can still rely on transaction atomicity and serializability.

Inside a transaction callback, all writes within a transaction are treated atomically - if there is a write conflict between two concurrent transactions, then one will be reverted, and none of its writes will be visible to subsequent `db.get` reads. Furthermore, transactions conflict when one reads a record that is concurrently written by another, preventing actions from "bypassing" effects on another branch and enforcing a serializable consistency on a per-record basis.

### Example contract using transactions

Here's a complete example contract that uses transactions to enforce group chat membership.

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
      const membershipKey = [roomId, userId].join("/")
      await this.db.delete("membership", membershipKey)
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

Here, any number of concurrent `createPost` actions can still be published by group members without conflict, so long they reference the same linear history of membership records. But if a user tries to publish a `createPost` action concurrently to a `removeMember` action that removes them from the group, this will cause a read conflict on the membership record. The write (`removeMember`) will take precedence over the read (`createPost`), and the `createPost` transaction will be reverted.

Similarly, if two concurrent `addMember` actions try to add the same user to the same room (maybe with conflicting `admin` roles), this sill cause a write conflict, and one will be reverted. Any `createPost` actions building on the reverted branch will be reverted as well, since transactional reads form "read dependencies" that recursively propagate reverts.

### Transaction revert conditions

To summarize, a transaction can be reverted for three reasons:

1. a _write conflict_ with a concurrent transaction (both transactions write to the same record)
2. a _read conflict_ with a concurrent transaction (one transaction reads from a record that the other writes to)
3. a _read dependency_ on a past transaction that is reverted (a reverted transaction recursively reverts to any subsequent transactions that read any of its values)

The revert status of a specific transaction is a subjective property - it depends on where in history we are looking at the transaction from. However, revert status is guaranteed to be monotonic - transactions only transition from not reverted to reverted as new messages are received, and never back to not reverted again.

Also important to note is that inside a transaction, `db.get` will only return values written by past transactions, and not any LWW values set outside a transaction callback. However, LWW reads will see all past values, both inside and outside transactions.
