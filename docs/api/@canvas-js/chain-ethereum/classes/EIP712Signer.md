[Documentation](../../../index.md) / [@canvas-js/chain-ethereum](../index.md) / EIP712Signer

# Class: EIP712Signer

## Implements

- [`SessionSigner`](../../interfaces/interfaces/SessionSigner.md)\<[`EIP712AuthorizationData`](../type-aliases/EIP712AuthorizationData.md)\>

## Constructors

### new EIP712Signer(init)

> **new EIP712Signer**(`init`): [`EIP712Signer`](EIP712Signer.md)

#### Parameters

• **init**: [`EIP712SignerInit`](../interfaces/EIP712SignerInit.md)= `{}`

#### Returns

[`EIP712Signer`](EIP712Signer.md)

#### Source

[EIP712Signer.ts:51](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum/src/EIP712Signer.ts#L51)

## Properties

### #ethersSigner

> **`private`** **#ethersSigner**: `AbstractSigner`\<`null` \| `Provider`\>

#### Source

[EIP712Signer.ts:49](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum/src/EIP712Signer.ts#L49)

***

### #store

> **`private`** **#store**: `SessionStore`

#### Source

[EIP712Signer.ts:48](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum/src/EIP712Signer.ts#L48)

***

### chainId

> **`readonly`** **chainId**: `number`

#### Source

[EIP712Signer.ts:44](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum/src/EIP712Signer.ts#L44)

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

[EIP712Signer.ts:42](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum/src/EIP712Signer.ts#L42)

***

### log

> **`private`** **`readonly`** **log**: `Logger`

#### Source

[EIP712Signer.ts:46](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum/src/EIP712Signer.ts#L46)

***

### sessionDuration

> **`readonly`** **sessionDuration**: `number`

#### Source

[EIP712Signer.ts:43](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum/src/EIP712Signer.ts#L43)

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

[EIP712Signer.ts:161](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum/src/EIP712Signer.ts#L161)

***

### getSession()

> **getSession**(`topic`, `options`): `Promise`\<[`Session`](../../interfaces/type-aliases/Session.md)\<[`EIP712AuthorizationData`](../type-aliases/EIP712AuthorizationData.md)\>\>

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

`Promise`\<[`Session`](../../interfaces/type-aliases/Session.md)\<[`EIP712AuthorizationData`](../type-aliases/EIP712AuthorizationData.md)\>\>

#### Implementation of

[`SessionSigner`](../../interfaces/interfaces/SessionSigner.md).[`getSession`](../../interfaces/interfaces/SessionSigner.md#getsession)

#### Source

[EIP712Signer.ts:81](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum/src/EIP712Signer.ts#L81)

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

[EIP712Signer.ts:58](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum/src/EIP712Signer.ts#L58)

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

[EIP712Signer.ts:138](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum/src/EIP712Signer.ts#L138)

***

### verifySession()

> **verifySession**(`topic`, `session`): `void`

Verify that `session.data` authorizes `session.publicKey`
to take actions on behalf of the user `${session.chain}:${session.address}`

#### Parameters

• **topic**: `string`

• **session**: [`Session`](../../interfaces/type-aliases/Session.md)\<[`EIP712AuthorizationData`](../type-aliases/EIP712AuthorizationData.md)\>

#### Returns

`void`

#### Implementation of

[`SessionSigner`](../../interfaces/interfaces/SessionSigner.md).[`verifySession`](../../interfaces/interfaces/SessionSigner.md#verifysession)

#### Source

[EIP712Signer.ts:60](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum/src/EIP712Signer.ts#L60)
