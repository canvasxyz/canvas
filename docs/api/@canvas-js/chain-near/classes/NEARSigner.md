[Documentation](../../../index.md) / [@canvas-js/chain-near](../index.md) / NEARSigner

# Class: NEARSigner

## Implements

- [`SessionSigner`](../../interfaces/interfaces/SessionSigner.md)

## Constructors

### new NEARSigner(__namedParameters)

> **new NEARSigner**(`__namedParameters`): [`NEARSigner`](NEARSigner.md)

#### Parameters

• **\_\_namedParameters**: `NEARSignerInit`= `{}`

#### Returns

[`NEARSigner`](NEARSigner.md)

#### Source

[NEARSigner.ts:34](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-near/src/NEARSigner.ts#L34)

## Properties

### #address

> **`private`** **#address**: `string`

#### Source

[NEARSigner.ts:28](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-near/src/NEARSigner.ts#L28)

***

### #keyPair

> **`private`** **#keyPair**: `KeyPair`

#### Source

[NEARSigner.ts:29](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-near/src/NEARSigner.ts#L29)

***

### #sessions

> **`private`** **#sessions**: `Record`\<`string`, [`Session`](../../interfaces/type-aliases/Session.md)\<`NEARSessionData`\>\> = `{}`

#### Source

[NEARSigner.ts:32](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-near/src/NEARSigner.ts#L32)

***

### #signers

> **`private`** **#signers**: `Record`\<`string`, [`Signer`](../../interfaces/interfaces/Signer.md)\<[`Message`](../../gossiplog/type-aliases/Message.md)\<[`Session`](../../interfaces/type-aliases/Session.md) \| [`Action`](../../interfaces/type-aliases/Action.md)\>\>\> = `{}`

#### Source

[NEARSigner.ts:31](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-near/src/NEARSigner.ts#L31)

***

### #store

> **`private`** **#store**: `SessionStore`

#### Source

[NEARSigner.ts:30](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-near/src/NEARSigner.ts#L30)

***

### chainId

> **`readonly`** **chainId**: `string`

#### Source

[NEARSigner.ts:24](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-near/src/NEARSigner.ts#L24)

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

[NEARSigner.ts:22](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-near/src/NEARSigner.ts#L22)

***

### log

> **`private`** **`readonly`** **log**: `Logger`

#### Source

[NEARSigner.ts:26](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-near/src/NEARSigner.ts#L26)

***

### sessionDuration

> **`readonly`** **sessionDuration**: `null` \| `number`

#### Source

[NEARSigner.ts:23](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-near/src/NEARSigner.ts#L23)

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

[NEARSigner.ts:155](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-near/src/NEARSigner.ts#L155)

***

### getSession()

> **getSession**(`topic`, `options`): `Promise`\<[`Session`](../../interfaces/type-aliases/Session.md)\<`NEARSessionData`\>\>

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

`Promise`\<[`Session`](../../interfaces/type-aliases/Session.md)\<`NEARSessionData`\>\>

#### Implementation of

[`SessionSigner`](../../interfaces/interfaces/SessionSigner.md).[`getSession`](../../interfaces/interfaces/SessionSigner.md#getsession)

#### Source

[NEARSigner.ts:64](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-near/src/NEARSigner.ts#L64)

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

[NEARSigner.ts:43](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-near/src/NEARSigner.ts#L43)

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

[NEARSigner.ts:132](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-near/src/NEARSigner.ts#L132)

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

[NEARSigner.ts:45](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-near/src/NEARSigner.ts#L45)
