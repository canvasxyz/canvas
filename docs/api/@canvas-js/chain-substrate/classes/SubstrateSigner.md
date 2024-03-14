[Documentation](../../../index.md) / [@canvas-js/chain-substrate](../index.md) / SubstrateSigner

# Class: SubstrateSigner

## Implements

- [`SessionSigner`](../../interfaces/interfaces/SessionSigner.md)

## Constructors

### new SubstrateSigner(init)

> **new SubstrateSigner**(`init`): [`SubstrateSigner`](SubstrateSigner.md)

#### Parameters

• **init**: `SubstrateSignerInit`= `{}`

#### Returns

[`SubstrateSigner`](SubstrateSigner.md)

#### Source

[SubstrateSigner.ts:45](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-substrate/src/SubstrateSigner.ts#L45)

## Properties

### #signer

> **`private`** **#signer**: `AbstractSigner`

#### Source

[SubstrateSigner.ts:42](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-substrate/src/SubstrateSigner.ts#L42)

***

### #store

> **`private`** **#store**: `SessionStore`

#### Source

[SubstrateSigner.ts:43](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-substrate/src/SubstrateSigner.ts#L43)

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

[SubstrateSigner.ts:36](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-substrate/src/SubstrateSigner.ts#L36)

***

### log

> **`private`** **`readonly`** **log**: `Logger`

#### Source

[SubstrateSigner.ts:38](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-substrate/src/SubstrateSigner.ts#L38)

***

### sessionDuration

> **`readonly`** **sessionDuration**: `null` \| `number`

#### Source

[SubstrateSigner.ts:37](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-substrate/src/SubstrateSigner.ts#L37)

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

[SubstrateSigner.ts:265](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-substrate/src/SubstrateSigner.ts#L265)

***

### getSession()

> **getSession**(`topic`, `options`): `Promise`\<[`Session`](../../interfaces/type-aliases/Session.md)\<`SubstrateSessionData`\>\>

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

`Promise`\<[`Session`](../../interfaces/type-aliases/Session.md)\<`SubstrateSessionData`\>\>

#### Implementation of

[`SessionSigner`](../../interfaces/interfaces/SessionSigner.md).[`getSession`](../../interfaces/interfaces/SessionSigner.md#getsession)

#### Source

[SubstrateSigner.ts:179](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-substrate/src/SubstrateSigner.ts#L179)

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

[SubstrateSigner.ts:141](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-substrate/src/SubstrateSigner.ts#L141)

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

[SubstrateSigner.ts:242](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-substrate/src/SubstrateSigner.ts#L242)

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

[SubstrateSigner.ts:143](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-substrate/src/SubstrateSigner.ts#L143)
