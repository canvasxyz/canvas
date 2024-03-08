# @canvas-js/signatures

Signature utilities for the Canvas data structures.

## Table of Contents

- [Signatures](#signatures)
- [Signed message tuples](#signed-message-tuples)
- [Session signers](#session-signers)

## Signatures

At the center of every Canvas app is a log of signed messages. The data in each message, before signing, looks like this:

```ts
type Message<Payload = unknown> = {
  topic: string
  clock: number
  parents: string[]
  payload: Payload
}
```

A message signature has three components:

- a `codec` string that identifies how to encode the message to bytes-to-be-signed.
- a `publicKey` [did:key URI](https://w3c-ccg.github.io/did-method-key/)
- a `signature` byte array containing the raw signature bytes

```ts
type Signature = {
  codec: string // "dag-cbor" | "dag-json" | "canvas-action-eip712" | "canvas-session-eip712"
  publicKey: string // did:key URI
  signature: Uint8Array
}
```

Only Secp256k1 and Ed25519 signature schemes are supported. Each did:key URI identifies its signature scheme using a multicodec varint in addition to encoding its public key.

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

The primary signer implementation is `Ed25519Signer`, exported here in `@canvas-js/signatures`. It uses the Ed25519 signature scheme and supports both `dag-json` and `dag-cbor` signature codecs.

```ts
// create a new random keypair
const signer = new Ed25519Signer()
console.log(signer.codecs) // ["dag-cbor", "dag-json"]
console.log(signer.uri)    // "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK"

// import an existing private key
const signer = new Ed25519Signer({ type: "ed25519", privateKey: new Uint8Array([ ... ])})
```

Every GossipLog instance has one "primary" signer it uses to sign new messages by default; if one is not provided in the initial config object then a random `Ed25519Signer` is created. This primary signer is also used to verify incoming messages.

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
