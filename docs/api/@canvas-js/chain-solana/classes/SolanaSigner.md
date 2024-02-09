[Documentation](../../../index.md) / [@canvas-js/chain-solana](../index.md) / SolanaSigner

# Class: SolanaSigner

## Implements

- [`SessionSigner`](../../interfaces/interfaces/SessionSigner.md)

## Constructors

### new SolanaSigner(__namedParameters)

> **new SolanaSigner**(`__namedParameters`): [`SolanaSigner`](SolanaSigner.md)

#### Parameters

• **\_\_namedParameters**: [`SolanaSignerInit`](../interfaces/SolanaSignerInit.md)= `{}`

#### Returns

[`SolanaSigner`](SolanaSigner.md)

#### Source

[SolanaSigner.ts:45](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-solana/src/SolanaSigner.ts#L45)

## Properties

### #signer

> **`private`** **#signer**: `GenericSigner`

#### Source

[SolanaSigner.ts:43](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-solana/src/SolanaSigner.ts#L43)

***

### #store

> **`private`** **#store**: `SessionStore`

#### Source

[SolanaSigner.ts:42](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-solana/src/SolanaSigner.ts#L42)

***

### chainId

> **`readonly`** **chainId**: `string`

#### Source

[SolanaSigner.ts:38](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-solana/src/SolanaSigner.ts#L38)

***

### key

> **`readonly`** **key**: `string`

A unique identifier based on the signer's arguments, used to trigger React effects.
This should not change unless user-provided arguments to the signers change.

For example, the key for `new SIWESigner()` should always remain the same, even if
a different burner wallet is generated on every call.

#### Implementation of

[`SessionSigner`](../../interfaces/interfaces/SessionSigner.md).[`key`](../../interfaces/interfaces/SessionSigner.md#key)

#### Source

[SolanaSigner.ts:36](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-solana/src/SolanaSigner.ts#L36)

***

### log

> **`private`** **`readonly`** **log**: `Logger`

#### Source

[SolanaSigner.ts:40](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-solana/src/SolanaSigner.ts#L40)

***

### sessionDuration

> **`readonly`** **sessionDuration**: `null` \| `number`

#### Source

[SolanaSigner.ts:37](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-solana/src/SolanaSigner.ts#L37)

## Methods

### clear()

> **clear**(`topic`): `Promise`\<`void`\>

#### Parameters

• **topic**: `string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`SessionSigner`](../../interfaces/interfaces/SessionSigner.md).[`clear`](../../interfaces/interfaces/SessionSigner.md#clear)

#### Source

[SolanaSigner.ts:182](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-solana/src/SolanaSigner.ts#L182)

***

### getSession()

> **getSession**(`topic`, `options`): `Promise`\<[`Session`](../../interfaces/type-aliases/Session.md)\<`SolanaSessionData`\>\>

`getSession` is called by the Canvas runtime for every new action appended
to the log (ie for new actions taken by local users, not existing messages
received from other peers via merkle sync or GossipSub).

It's responsible for returning a `Session` that matches the given parameters,
either by looking up a cached session, or by getting user authorization to create
a new one (and then caching it).

"Matching the given parameters" means that the caller passes a `topic: string`
and an optional `chain?: string; timestamp?: number`, and `getSession` must return
a `Session` authorized for that topic, that specific chain (if provided), and that
is valid for the given timestamp (if provided).

#### Parameters

• **topic**: `string`

• **options**= `{}`

• **options\.fromCache?**: `boolean`

• **options\.timestamp?**: `number`

#### Returns

`Promise`\<[`Session`](../../interfaces/type-aliases/Session.md)\<`SolanaSessionData`\>\>

#### Implementation of

[`SessionSigner`](../../interfaces/interfaces/SessionSigner.md).[`getSession`](../../interfaces/interfaces/SessionSigner.md#getsession)

#### Source

[SolanaSigner.ts:95](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-solana/src/SolanaSigner.ts#L95)

***

### match()

> **`readonly`** **match**(`chain`): `boolean`

#### Parameters

• **chain**: `string`

#### Returns

`boolean`

#### Implementation of

[`SessionSigner`](../../interfaces/interfaces/SessionSigner.md).[`match`](../../interfaces/interfaces/SessionSigner.md#match)

#### Source

[SolanaSigner.ts:73](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-solana/src/SolanaSigner.ts#L73)

***

### sign()

> **sign**(`message`): [`Signature`](../../interfaces/type-aliases/Signature.md)

#### Parameters

• **message**: [`Message`](../../gossiplog/type-aliases/Message.md)\<[`Session`](../../interfaces/type-aliases/Session.md) \| [`Action`](../../interfaces/type-aliases/Action.md)\>

#### Returns

[`Signature`](../../interfaces/type-aliases/Signature.md)

#### Implementation of

[`SessionSigner`](../../interfaces/interfaces/SessionSigner.md).[`sign`](../../interfaces/interfaces/SessionSigner.md#sign)

#### Source

[SolanaSigner.ts:159](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-solana/src/SolanaSigner.ts#L159)

***

### verifySession()

> **verifySession**(`topic`, `session`): `void`

Verify that `session.data` authorizes `session.publicKey`
to take actions on behalf of the user `${session.chain}:${session.address}`

#### Parameters

• **topic**: `string`

• **session**: [`Session`](../../interfaces/type-aliases/Session.md)

#### Returns

`void`

#### Implementation of

[`SessionSigner`](../../interfaces/interfaces/SessionSigner.md).[`verifySession`](../../interfaces/interfaces/SessionSigner.md#verifysession)

#### Source

[SolanaSigner.ts:75](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-solana/src/SolanaSigner.ts#L75)
