[Documentation](../../../index.md) / [@canvas-js/chain-cosmos](../index.md) / CosmosSigner

# Class: CosmosSigner

## Implements

- [`SessionSigner`](../../interfaces/interfaces/SessionSigner.md)

## Constructors

### new CosmosSigner(__namedParameters)

> **new CosmosSigner**(`__namedParameters`): [`CosmosSigner`](CosmosSigner.md)

#### Parameters

• **\_\_namedParameters**: [`CosmosSignerInit`](../interfaces/CosmosSignerInit.md)= `{}`

#### Returns

[`CosmosSigner`](CosmosSigner.md)

#### Source

[CosmosSigner.ts:36](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-cosmos/src/CosmosSigner.ts#L36)

## Properties

### #signer

> **`private`** **#signer**: `GenericSigner`

#### Source

[CosmosSigner.ts:33](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-cosmos/src/CosmosSigner.ts#L33)

***

### #store

> **`private`** **#store**: `SessionStore`

#### Source

[CosmosSigner.ts:34](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-cosmos/src/CosmosSigner.ts#L34)

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

[CosmosSigner.ts:29](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-cosmos/src/CosmosSigner.ts#L29)

***

### log

> **`private`** **`readonly`** **log**: `Logger`

#### Source

[CosmosSigner.ts:31](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-cosmos/src/CosmosSigner.ts#L31)

***

### sessionDuration

> **`readonly`** **sessionDuration**: `null` \| `number`

#### Source

[CosmosSigner.ts:30](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-cosmos/src/CosmosSigner.ts#L30)

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

[CosmosSigner.ts:172](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-cosmos/src/CosmosSigner.ts#L172)

***

### getSession()

> **getSession**(`topic`, `options`): `Promise`\<[`Session`](../../interfaces/type-aliases/Session.md)\<`CosmosSessionData`\>\>

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

`Promise`\<[`Session`](../../interfaces/type-aliases/Session.md)\<`CosmosSessionData`\>\>

#### Implementation of

[`SessionSigner`](../../interfaces/interfaces/SessionSigner.md).[`getSession`](../../interfaces/interfaces/SessionSigner.md#getsession)

#### Source

[CosmosSigner.ts:85](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-cosmos/src/CosmosSigner.ts#L85)

***

### match()

> **`readonly`** **match**(`address`): `boolean`

#### Parameters

• **address**: `string`

#### Returns

`boolean`

#### Implementation of

[`SessionSigner`](../../interfaces/interfaces/SessionSigner.md).[`match`](../../interfaces/interfaces/SessionSigner.md#match)

#### Source

[CosmosSigner.ts:55](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-cosmos/src/CosmosSigner.ts#L55)

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

[CosmosSigner.ts:149](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-cosmos/src/CosmosSigner.ts#L149)

***

### verifySession()

> **verifySession**(`topic`, `session`): `Promise`\<`void`\>

Verify that `session.data` authorizes `session.publicKey`
to take actions on behalf of the user `${session.chain}:${session.address}`

#### Parameters

• **topic**: `string`

• **session**: [`Session`](../../interfaces/type-aliases/Session.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`SessionSigner`](../../interfaces/interfaces/SessionSigner.md).[`verifySession`](../../interfaces/interfaces/SessionSigner.md#verifysession)

#### Source

[CosmosSigner.ts:57](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-cosmos/src/CosmosSigner.ts#L57)
