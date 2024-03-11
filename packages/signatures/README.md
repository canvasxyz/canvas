# @canvas-js/signatures

Signature utilities for the Canvas data structures.

## Table of Contents

- [Overview](#overview)
- [Message format](#message-format)
- [Signature schemes and codecs](#signature-schemes-and-codecs)
- [Signed message tuples](#signed-message-tuples)
- [Session signers](#session-signers)

## Summary

Each Canvas application is built around a log of signed messages:

```
 |-------------------------|        |-------------------------|        |-------------------------|
 | Message<Session>        |        | Message<Action>         |        | Message<Action>         |
 | topic: ...              |        | topic: ...              |        | topic: ...              |
 | clock: 0                |        | clock: 1                |        | clock: 2                |
 | parents: [Message]      |        | parents: [Message]      |        | parents: [Message]      |
 | payload:                |  --->  | payload:                |  --->  | payload:                |
 |   type: "session"       |        |   type: "action"        |        |   type: "action"        |
 |   address: ...          |        |   address: ...          |        |   address: ...          |
 |   publicKey: ...        |        |   name: ...             |        |   name: ...             |
 |   authorizationData:    |        |   args: ...             |        |   args: ...             |
 |     signature: ...      |        |   timestamp: ...        |        |   timestamp: ...        |
 |-------------------------|        |-------------------------|        |-------------------------|

 |-------------------------|        |-------------------------|        |-------------------------|
 | Signature               |        | Signature               |        | Signature               |
 |   codec: ...            |        |   codec: ...            |        |   codec: ...            |
 |   publicKey: ...        |        |   publicKey: ...        |        |   publicKey: ...        |
 |   signature: ...        |        |   signature: ...        |        |   signature: ...        |
 |-------------------------|        |-------------------------|        |-------------------------|
```

Each Message is paired with a Signature that cryptographically
authenticates the message as coming from the expected user. To
accomplish this, the message is signed by the publicKey on the
signature, which you can think of as the user's session key.

To authorize a session key, the first time it is used on the log,
it must be used to sign a Message<Session> which authorizes itself
(`publicKey`) to be used by the user (`address`).

This authorization is stored in an `AuthorizationData` object
inside the Session, and checked by the signer package(s) provided
to the log, e.g. SIWESigner, Eip712Signer, ATPSigner.

The AuthorizationData can just be a simple `{ signature }`, but
some wallets or DIDs may use other data to generate a signature.
For example, Sign In With Ethereum expects an issuance time,
expiry time, and URI to generate a sign-in popup.

Under the hood, signer packages use the Ed25519DelegateSigner and
Secp256k1DelegateSigner classes which provide `sign()` and `verify()`
to create/verify session-key signatures for the message.

Session signers also expose `newSession()` and `verifySession()`
methods, to create/verify Sessions and initialize new session keys.

### Message format

Messages are implemented as a generic class that accepts different
Payloads, which may be actions or sessions.

```ts
type Message<Payload = unknown> = {
  topic: string
  clock: number
  parents: string[]
  payload: Payload
}
```

Each `Message` is stored alongside a `Signature` in the log as a
`[Message, Signature]` tuple, that includes:

- a `codec` string that identifies how to encode the message to bytes for signing
- a `publicKey` [did:key URI](https://w3c-ccg.github.io/did-method-key/)
- a `signature` byte array containing the raw signature bytes

```ts
type Signature = {
  codec: "dag-cbor" | "dag-json" | "canvas-action-eip712" | "canvas-session-eip712"
  publicKey: string // did:key URI
  signature: Uint8Array
}
```

For ordinary offchain applications, `dag-cbor` is used to encode all types
of messages, both Actions and Sessions.

For applications that may need to be verified onchain, `canvas-action-eip712`
and `canvas-session-eip712` codecs are used to encode Actions and Sessions
respectively.

## Signature schemes and codecs

Only Secp256k1 and Ed25519 signature schemes are supported. Each
did:key URI identifies its signature scheme using a multicodec varint
in addition to encoding its public key.

The four supported `codec` values are

- `dag-cbor`, which canonically encodes the entire message to JSON using the [dag-cbor IPLD codec](https://ipld.io/docs/codecs/known/dag-cbor/)
- `dag-json`, which canonically encodes the entire message to CBOR using the [dag-json IPLD codec](https://ipld.io/docs/codecs/known/dag-json/)
- `canvas-action-eip712`, which encodes `Message<Action>` objects to a keccak-256 hash using a fixed EIP-712 schema
- `canvas-session-eip712`, which encodes `Message<Session<Eip712SessionData>>` objects to a keccak-256 hash using a fixed EIP-712 schema

One important consideration here is that the Ed25519 signature schemes includes a prehash step as a part of the specification, and thus can safely sign byte arrays of any length. Secp256k1 doesn't, and can only sign 32-byte hashes.

What this means is that the `dag-cbor` and `dag-json` signature codecs can only be used with Ed25519 keypairs, since Secp256k1 doesn't specify a prehash step. Meanwhile, `canvas-action-eip712` and `canvas-session-eip712` can only be used with Secp256k1 keypairs, since that's already part of the EIP-712 specification.

JSON and CBOR can encode arbitrary objects, so they can be used with for messages with any kind of payload. EIP-712 can only be used with static types, which is why we need separate codecs `canvas-action-eip712` and `canvas-session-eip712` for actions and sessions. This also means that `canvas-session-eip712` can only be used with `Eip712Signer` sessions, which have a `Eip712SessionData` object as the session `authorizationData`.

```ts
type Eip712SessionData = {
  signature: Uint8Array
}
```

## Signed message tuples

Once a message has been signed, we need another serialization format to use for storing the signature and message together in the log, for gossiping over libp2p, and for sending over the wire during merkle sync. For these, we use a compact tuple representation encoded with dag-cbor.

```ts
export type SignatureTuple = [codec: string, publicKey: string, signature: Uint8Array]

export type MessageTuple = [
  signature: SignatureTuple,
  topic: string,
  clock: number,
  parents: Uint8Array[],
  payload: unknown,
]
```

This format is also used to derive message IDs. From the GossipLog documentation:

> Message IDs begin with the message clock, encoded as a **reverse** unsigned varint, followed by the sha2-256 hash of the serialized signed message, and truncated to 20 bytes total. These are encoded using the [`base32hex`](https://www.rfc-editor.org/rfc/rfc4648#section-7) alphabet to get 32-character string IDs, like `054ki1oubq8airsc9d8sbg0t7itqbdlf`.

The hash is the sha2-256 of the cbor-encoded message tuple.

## Signers

GossipLog uses the `Signer` interface to manage signing and verifying messages.

```ts
interface Signer<Payload = unknown> {
  uri: string // did:key URI
  codecs: string[]

  sign(message: Message<Payload>, options?: { codec?: string }): Awaitable<Signature>
  verify(signature: Signature, message: Message<Payload>): Awaitable<void>
  export(): { type: string; privateKey: Uint8Array }
}
```

The primary signer implementation is `Ed25519Delegate`, exported here in `@canvas-js/signatures`. It uses the Ed25519 signature scheme and supports both `dag-json` and `dag-cbor` signature codecs.

```ts
// create a new random keypair
const signer = new Ed25519Delegate()
console.log(signer.codecs) // ["dag-cbor", "dag-json"]
console.log(signer.uri)    // "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK"

// import an existing private key
const signer = new Ed25519Delegate({ type: "ed25519", privateKey: new Uint8Array([ ... ])})
```

Every GossipLog instance has one "primary" signer it uses to sign new messages by default; if one is not provided in the initial config object then a random `Ed25519Delegate` is created. This primary signer is also used to verify incoming messages.

These behaviors can be overriden by providing a `verifySignature: (signature: Signature, message: Message<Payload>) => Awaitable<void>` function in the initial GossipLog config object, and passing an explicit signer in the options argument of the `append` method.

## Session signers

GossipLog and the `Signer` interface are designed to be relatively generic; "actions" and "sessions" are specific to Canvas apps.

Canvas apps use signers implementing the `SessionSigner` interface:

```ts
interface SessionSigner<AuthorizationData = any> {
  codecs: string[]
  key: string
  match: (address: string) => boolean
  verify: (signature: Signature, message: Message<Action | Session<AuthorizationData>>) => Awaitable<void>
  verifySession: (topic: string, session: Session<AuthorizationData>) => Awaitable<void>

  sign(message: Message<Action | Session<AuthorizationData>>, options?: { codec?: string }): Awaitable<Signature>
  getSession: (
    topic: string,
    options?: { timestamp?: number; fromCache?: boolean },
  ) => Awaitable<Session<AuthorizationData>>
  clear(topic: string): Awaitable<void>
}
```

This looks complicated but it essentially extends a `Signer<Action | Session<AuthorizationData>>` interface with methods to authorize and verify sessions.
