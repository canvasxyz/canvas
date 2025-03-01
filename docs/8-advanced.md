---
title: "Advanced Features"
---

# Advanced Features

## Table of Contents

- [Handling conflicting offline edits](#handling-conflicting-offline-edits)
  - [Using merge functions](#using-merge-functions)
- [Creating your own session signer](#creating-your-own-session-signer)
- [Validating custom action schemas using IPLD](#validating-custom-action-schemas-using-ipld)
- [Configuring WebRTC transports](#configuring-webrtc-transports)
- [Configuring universal replication servers](#configuring-universal-replication-servers)
- [Disabling sequencing](#disabling-sequencing)
- [Debugging](#debugging)

## Handling conflicting offline edits

In the default implementation of Canvas, we assume that users remain online most of the time, and so, tiebreaks between people editing the same value are handled arbitrarily.

However, if you have users who might go offline for extended periods of time, or sync large batches of edits that write to the same database rows as other users, then edits will be merged in unpredictable ways.

Consider this action graph, where actions `t1a` and `t2a` edit the same value, and `t2a` and `t2b` also edit the same value:

```
t0 ->- t1a ->- t2a ->- t3
	|			  	|
	-- t1b ->- t2b --

// t1a: db.set(table, { foo: 'foo' })
// t1b: db.set(table, { foo: 'baz' })
// t2a: db.set(table, { bar: 'qux' })
// t2b: db.set(table, { bar: 'qax' })
```

The value of `foo` might be `bar` or `baz` after executing these actions. The tiebreak comes down to whichever one has an action hash that is lexicographically greater, which, in practice, is randomly determined at the time of creation.

Note that this tiebreaking is applied independently for each database value, which means that it's possible (with 50% likelihood in the example) that values from one branch of the causal graph are mixed with values of the other -- i.e. we end up with `foo = 'bar'` and `bar = 'qax'` in the database.

## Creating your own session signer

You can create a session signer that implements any form of cryptographic authorization, including new blockchain signers, [JWT](https://jwt.io/) or [UCAN](https://ucan.xyz/) verifiers, and zero-knowledge proof verifiers.

The session signer interface looks like this:

```ts
import type { Signature, Message, Action, Session } from "@canvas-js/interfaces"

interface SessionSigner {
  match: (chain: string) => boolean

  /**
   * `getSession` is called by the Canvas runtime for every new action appended
   * to the log (ie for new actions taken by local users, not existing messages
   * received from other peers via merkle sync or GossipSub).
   *
   * It's responsible for returning a `Session` that matches the given parameters,
   * either by looking up a cached session, or by getting user authorization to create
   * a new one (and then caching it).
   *
   * "Matching the given parameters" means that the caller passes a `topic: string`
   * and an optional `chain?: string; timestamp?: number`, and `getSession` must return
   * a `Session` authorized for that topic, that specific chain (if provided), and that
   * is valid for the given timestamp (if provided).
   */
  getSession: (topic: string, options?: { chain?: string; timestamp?: number }) => Awaitable<Session<AuthorizationData>>

  /**
   * Verify that `session.data` authorizes `session.publicKey`
   * to take actions on behalf of the user `${session.chain}:${session.address}`
   */
  verifySession: (topic: string, session: Session<AuthorizationData>) => Awaitable<void>

  clear(topic: string): Awaitable<void>

  /**
   * A unique identifier based on the signer's arguments, used to trigger React effects.
   * This should not change unless user-provided arguments to the signers change.
   *
   * For example, the key for `new SIWESigner()` should always remain the same, even if
   * a different burner wallet is generated on every call.
   */
  key: string
}
```

To create a new session signer, you should define a `getSession` method which produces a new `Session` object with the appropriate authorization data (e.g. a signed SIWE message, EIP-712 message, etc.).

Also define a `verifySession` method which verifies that the provided session data was correctly signed.

To define which chains or authorization strategies your signer works with, you should supply an implementation of the `match: (chain: string) => boolean` method.

When an app receives a new session from one of its peers, it searches its available session signers to find one matching `signer.match(session.chain)`, and uses it to verify the chain-specific authorization data with `await signer.verifySession(session)`.

Once the user has provided the chain-specific session authorization data, it’s wrapped in a `Session` object and added to the message log, alongside actions themselves.

```ts
type Session = {
  type: "session"

  /** DID of the user that authorized the session (e.g. "did:pkh:eip155:1:0xb94d27...") */
  address: string

  /** did:key URI of the ephemeral session key used to sign subsequent actions */
  publicKey: string

  /** chain-specific session payload, e.g. a SIWE message & signature */
  authorizationData: any

  blockhash: string | null
  timestamp: number
  duration: number | null
}
```

The ephemeral session key is a regular Ed25519 or Secp256k1 keypair generated and managed by the signer, defined in the `SessionSigner` interface. Its public key is included in the session, as a `did:key` URI. (We may add a couple of other formats for ephemeral session keys in the future, that can be verified on-chain.)

The session `data` type is unique to each Signer class, and includes the particular signature format, as well as any other metadata used to generate the signature - e.g. some signers require nonces, domain identifiers, or other information.

## Validating custom action schemas using IPLD

By default, Canvas apps will accept any JSON, CBOR, or IPLD value as the argument to an action (IPLD is a superset of JSON and CBOR).

It's up to each action handler to validate its `args` and throw an error if they're invalid.

```ts
const app = await Canvas.initialize({
  contract: {
    topic: "com.example.my-app",
    models: { ... },
    actions: {
      async createPost(db, args, { id, chain, address }) {
        assert(typeof args === "object")
        assert(typeof args.content === "string")
        assert(typeof args.replyTo === "string" || args.replyTo === null)
        await db.set("posts", { id, content: args.content, replyTo: args.replyTo, ... })
      },
    }
  }
})
```

Doing runtime validation by hand like this is tedious and error-prone. Instead, contracts can define action handlers in an expanded object format, and provide a reference `argsType` to a type inside an [IPLD schema](https://ipld.io/docs/schemas/) alongside the action's `apply` function.

In this example, Canvas will verify that the `args` value satisfies the `CreatePostArgs` type before calling `actions.createPost.apply`.

```ts
const schema = `
type CreatePostArgs struct {
  content String
  replyTo nullable String
  tags    [String]
}

type DeletePostArgs struct {
  postId String
}
`

const app = await Canvas.initialize({
  contract: {
    topic: "com.example.my-app",
    models: { ... },
    actions: {
      createPost: {
        argsType: { schema, name: "CreatePostArgs" },
        apply: async (db, { content, replyTo, tags }, { id }) => {
          // content: string
          // replyTo: string | null
          // tags: string[]
          // ...
        },
      },
      deletePost: {
        argsType: { schema, name: "DeletePostArgs" },
        apply: async (db, { postId }, { id }) => {
          // postId: string
        },
      },
    },
  },
})
```

## Configuring WebRTC transports

Canvas applications can run over both WebSockets and browser-to-browser WebRTC, but for production applications, we recommend using only WebSockets for reliability.

WebRTC is currently disabled by default, unless you set `enableWebRTC: true`.

This means that your application will need a WebSocket server, e.g. an instance of your application running in Node.js or the Canvas CLI, or on a server hosted by someone else.

## Debugging

To enable debugging output, you can set a filter in localStorage:

`localStorage.setItem("debug", "canvas:*")`

To enable debugging for libp2p, you can set a similar filter:

`localStorage.setItem("debug", "canvas:*, libp2p:*")`

When using the command line, set an environment variable instead:

`DEBUG="canvas:*"`

Finally, there are times when past data in IndexedDB may interfere
with an application's operation. We try to detect and recover from
this scenario, but if you encounter it, you can run this in the
console to clear any past data:

```ts
const dbs = await window.indexedDB.databases()
dbs.forEach((db) => {
  window.indexedDB.deleteDatabase(db.name)
})
```
