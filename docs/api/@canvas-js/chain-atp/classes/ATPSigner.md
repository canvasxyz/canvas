[Documentation](../../../index.md) / [@canvas-js/chain-atp](../index.md) / ATPSigner

# Class: ATPSigner

## Implements

- [`SessionSigner`](../../interfaces/interfaces/SessionSigner.md)\<[`ATPSessionData`](../type-aliases/ATPSessionData.md)\>

## Constructors

### new ATPSigner(options)

> **new ATPSigner**(`options`): [`ATPSigner`](ATPSigner.md)

#### Parameters

• **options**: [`ATPSignerOptions`](../interfaces/ATPSignerOptions.md)= `{}`

#### Returns

[`ATPSigner`](ATPSigner.md)

#### Source

[ATPSigner.ts:45](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-atp/src/ATPSigner.ts#L45)

## Properties

### #agent

> **`private`** **#agent**: `BskyAgent`

#### Source

[ATPSigner.ts:42](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-atp/src/ATPSigner.ts#L42)

***

### #session

> **`private`** **#session**: `null` \| `AtpSessionData` = `null`

#### Source

[ATPSigner.ts:43](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-atp/src/ATPSigner.ts#L43)

***

### #store

> **`private`** **#store**: `SessionStore`

#### Source

[ATPSigner.ts:41](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-atp/src/ATPSigner.ts#L41)

***

### key

> **`readonly`** **key**: `string` = `"ATPSigner"`

A unique identifier based on the signer's arguments, used to trigger React effects.
This should not change unless user-provided arguments to the signers change.

For example, the key for `new SIWESigner()` should always remain the same, even if
a different burner wallet is generated on every call.

#### Implementation of

[`SessionSigner`](../../interfaces/interfaces/SessionSigner.md).[`key`](../../interfaces/interfaces/SessionSigner.md#key)

#### Source

[ATPSigner.ts:33](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-atp/src/ATPSigner.ts#L33)

***

### log

> **`private`** **`readonly`** **log**: `Logger`

#### Source

[ATPSigner.ts:39](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-atp/src/ATPSigner.ts#L39)

***

### options

> **`private`** **`readonly`** **options**: [`ATPSignerOptions`](../interfaces/ATPSignerOptions.md) = `{}`

#### Source

[ATPSigner.ts:45](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-atp/src/ATPSigner.ts#L45)

## Methods

### clear()

> **clear**(`topic`): `void`

#### Parameters

• **topic**: `string`

#### Returns

`void`

#### Implementation of

[`SessionSigner`](../../interfaces/interfaces/SessionSigner.md).[`clear`](../../interfaces/interfaces/SessionSigner.md#clear)

#### Source

[ATPSigner.ts:186](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-atp/src/ATPSigner.ts#L186)

***

### getAddress()

> **`private`** **getAddress**(): `Promise`\<`string`\>

#### Returns

`Promise`\<`string`\>

#### Source

[ATPSigner.ts:65](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-atp/src/ATPSigner.ts#L65)

***

### getSession()

> **getSession**(`topic`, `options`): `Promise`\<[`Session`](../../interfaces/type-aliases/Session.md)\<[`ATPSessionData`](../type-aliases/ATPSessionData.md)\>\>

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

• **options\.chain?**: `string`

• **options\.fromCache?**: `boolean`

• **options\.timestamp?**: `number`

#### Returns

`Promise`\<[`Session`](../../interfaces/type-aliases/Session.md)\<[`ATPSessionData`](../type-aliases/ATPSessionData.md)\>\>

#### Implementation of

[`SessionSigner`](../../interfaces/interfaces/SessionSigner.md).[`getSession`](../../interfaces/interfaces/SessionSigner.md#getsession)

#### Source

[ATPSigner.ts:88](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-atp/src/ATPSigner.ts#L88)

***

### match()

> **match**(`address`): `boolean`

#### Parameters

• **address**: `string`

#### Returns

`boolean`

#### Implementation of

[`SessionSigner`](../../interfaces/interfaces/SessionSigner.md).[`match`](../../interfaces/interfaces/SessionSigner.md#match)

#### Source

[ATPSigner.ts:47](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-atp/src/ATPSigner.ts#L47)

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

[ATPSigner.ts:163](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-atp/src/ATPSigner.ts#L163)

***

### verifySession()

> **verifySession**(`topic`, `session`): `Promise`\<`void`\>

Verify that `session.data` authorizes `session.publicKey`
to take actions on behalf of the user `${session.chain}:${session.address}`

#### Parameters

• **topic**: `string`

• **session**: [`Session`](../../interfaces/type-aliases/Session.md)\<[`ATPSessionData`](../type-aliases/ATPSessionData.md)\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`SessionSigner`](../../interfaces/interfaces/SessionSigner.md).[`verifySession`](../../interfaces/interfaces/SessionSigner.md#verifysession)

#### Source

[ATPSigner.ts:49](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-atp/src/ATPSigner.ts#L49)

***

### createAuthenticationMessage()

> **`static`** **createAuthenticationMessage**(`topic`, `publicKey`, `address`): `string`

#### Parameters

• **topic**: `string`

• **publicKey**: `string`

• **address**: `string`

#### Returns

`string`

#### Source

[ATPSigner.ts:35](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-atp/src/ATPSigner.ts#L35)
