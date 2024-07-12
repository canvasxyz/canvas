[Documentation](../../../packages.md) / [@canvas-js/interfaces](../index.md) / Session

# Type Alias: Session\<AuthorizationData\>

> **Session**\<`AuthorizationData`\>: `object`

Sessions consist of an ephemeral keypair and some chain-specific
data representing a user's (temporary) authorization of that
keypair to sign actions on their behalf.

## Type Parameters

• **AuthorizationData** = `any`

## Type declaration

### authorizationData

> **authorizationData**: `AuthorizationData`

chain-specific session payload, e.g. a SIWE message & signature

### context

> **context**: `object`

### context.blockhash?

> `optional` **context.blockhash**: `string`

### context.duration?

> `optional` **context.duration**: `number`

### context.timestamp

> **context.timestamp**: `number`

### did

> **did**: \`did:$\{string\}\`

DID of the user that authorized the session (e.g. "did:pkh:eip155:1:0xb94d27...")

### publicKey

> **publicKey**: `string`

did:key URI of the ephemeral session key used to sign subsequent actions

### type

> **type**: `"session"`

## Defined in

[Session.ts:6](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/Session.ts#L6)
