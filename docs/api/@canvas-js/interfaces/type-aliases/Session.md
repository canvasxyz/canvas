[Documentation](../../../index.md) / [@canvas-js/interfaces](../index.md) / Session

# Type alias: Session\<AuthorizationData\>

> **Session**\<`AuthorizationData`\>: `Object`

Sessions consist of an ephemeral keypair and some chain-specific
data representing a user's (temporary) authorization of that
keypair to sign actions on their behalf.

## Type parameters

• **AuthorizationData** = `any`

## Type declaration

### address

> **address**: `string`

DID or CAIP-2 address that authorized the session (e.g. "eip155:1:0xb94d27...")

### authorizationData

> **authorizationData**: `AuthorizationData`

chain-specific session payload, e.g. a SIWE message & signature

### blockhash

> **blockhash**: `string` \| `null`

### duration

> **duration**: `number` \| `null`

### publicKey

> **publicKey**: `string`

did:key URI of the ephemeral session key used to sign subsequent actions

### timestamp

> **timestamp**: `number`

### type

> **type**: `"session"`

## Source

[Session.ts:6](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/interfaces/src/Session.ts#L6)
