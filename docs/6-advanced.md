---
title: "Advanced Features"
---

# Advanced Features

## Table of Contents

- [Creating your own session signer](#creating-your-own-session-signer)
- [Validating action arguments using IPLD Schemas](#validating-action-arguments-using-ipld-schemas)

## Creating your own session signer

A session signer can be created for any public-key authorization format, including different blockchain signers, JWTs/UCANs, or other object capability protocols.

The session signer interface looks like this:

```jsx
import type { Signature, Message, Action, Session } from "@canvas-js/interfaces"

interface SessionSigner {
  match: (chain: string) => boolean

  sign: (message: Message<Action | Session>) => Signature

	/**
	 * Produce an authenticated Session, which authorizes `session.publicKey`
	 * to represent the user `${session.chain}:${session.address}`.
	 *
	 * The signature is stored in `session.data`, and the entire Session
	 * object is then signed using the session-key and appended to our log.
	 */
  getSession: (
    topic: string,
    options?: { chain?: string; timestamp?: number },
  ) => Promise<Session>

  /**
   * Verify that `session.data` authorizes `session.publicKey`
   * to take actions on behalf of the user `${session.chain}:${session.address}`
   */
  verifySession: (session: Session) => Promise<void>
}
```

To create a new session signer, you should define a `getSession` method which produces a new `Session` object with the appropriate authorization data (e.g. a signed SIWE message, EIP-712 message, etc.), and define a `verifySession` method which verifies that the provided session data was correctly signed.

Families of chains are expressed as `match: (chain: string) => boolean` predicates over CAIP-2 prefixes. When a Canvas app receives a new session from one of its peers, it searches its available session signers to find one matching `signer.match(session.chain)`, and uses it to verify the chain-specific authorization data with `await signer.verifySession(session)`.

Once the user has provided the chain-specific session authorization data, it’s wrapped in a `Session` object and added to the message log, alongside actions themselves.

```jsx
type Session = {
  type: "session"

  /** CAIP-2 prefix, e.g. "eip155:1" for mainnet Ethereum */
  chain: string
  /** CAIP-2 address (without the prefix, e.g. "0xb94d27...") */
  address: string

  /** ephemeral session key used to sign subsequent actions */
  publicKeyType: "ed25519" | "secp256k1"
  publicKey: Uint8Array

  /** chain-specific session authorization, e.g. a SIWE message & signature */
  data: any

  blockhash: string | null
  timestamp: number
  duration: number | null
}
```

The ephemeral session key is a regular Ed25519 or Secp256k1 keypair generated and managed by the signer, defined in the `SessionSigner` interface.

The session `data` type is unique to each Signer class, and includes the particular signature format, as well as any other metadata used to generate the signature (e.g. some signers require nonces, domain identifiers, or other information).

## Validating action arguments using IPLD Schemas

By default, Canvas apps will accept any IPLD value as the argument to an action, and it's up to each action handler to validate its `args` and throw an error if they're invalid.

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
        await db.posts.set({ id, content: args.content, replyTo: args.replyTo, ... })
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
