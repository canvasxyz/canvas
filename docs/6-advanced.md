---
title: "Advanced Features"
---

# Advanced features

## Table of Contents

- [Creating your own session signer](#creating-your-own-session-signer)

## Creating your own session signer

A session signer can be created for any public-key authorization format, including different blockchain signers, JWTs/UCANs, or other object capability protocols.

The session signer interface looks like this:

```jsx
import type { Signature } from "@canvas-js/signed-cid"
import type { Message, Action, Session } from "@canvas-js/interfaces"

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

Once the user has signed the chain-specific session authorization data, it’s wrapped in a `Session` object and added to the message log, alongside actions themselves.

```jsx
type Session<Data = unknown> = {
  type: "session"

  /** CAIP-2 prefix, e.g. "eip155:1" for mainnet Ethereum */
  chain: string
  /** CAIP-2 address (without the prefix, e.g. "0xb94d27...") */
  address: string

  /** ephemeral session key used to sign subsequent actions */
  publicKeyType: "ed25519" | "secp256k1"
  publicKey: Uint8Array

  /** chain-specific session authorization, e.g. a SIWE message & signature */
  data: Data

  blockhash: string | null
  timestamp: number
  duration: number | null
}
```

The ephemeral session key is a regular Ed25519 or Secp256k1 keypair generated and managed by the signer, defined in the `SessionSigner` interface.

The session `Data` is unique to each Signer class, and includes the particular signature format, as well as any other metadata used to generate the signature (e.g. some signers require nonces, domain identifiers, or other information).
