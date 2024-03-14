[Documentation](../../../index.md) / [@canvas-js/chain-ethereum-viem](../index.md) / SIWESignerViem

# Class: SIWESignerViem

## Implements

- [`SessionSigner`](../../interfaces/interfaces/SessionSigner.md)\<`SIWESessionData`\>

## Constructors

### new SIWESignerViem(init)

> **new SIWESignerViem**(`init`): [`SIWESignerViem`](SIWESignerViem.md)

#### Parameters

• **init**: [`SIWESignerViemInit`](../interfaces/SIWESignerViemInit.md)= `{}`

#### Returns

[`SIWESignerViem`](SIWESignerViem.md)

#### Source

[packages/chain-ethereum-viem/src/SIWESignerViem.ts:46](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum-viem/src/SIWESignerViem.ts#L46)

## Properties

### #account

> **`private`** **#account**: `Object`

#### #account.getAddress

> **getAddress**: () => `Promise`\<\`0x${string}\`\>

##### Returns

`Promise`\<\`0x${string}\`\>

#### #account.sign

> **sign**: (`message`) => `Promise`\<\`0x${string}\`\>

##### Parameters

• **message**: `string`

##### Returns

`Promise`\<\`0x${string}\`\>

#### Source

[packages/chain-ethereum-viem/src/SIWESignerViem.ts:41](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum-viem/src/SIWESignerViem.ts#L41)

***

### #store

> **`private`** **#store**: `SessionStore`

#### Source

[packages/chain-ethereum-viem/src/SIWESignerViem.ts:40](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum-viem/src/SIWESignerViem.ts#L40)

***

### chainId

> **`readonly`** **chainId**: `number`

#### Source

[packages/chain-ethereum-viem/src/SIWESignerViem.ts:36](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum-viem/src/SIWESignerViem.ts#L36)

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

[packages/chain-ethereum-viem/src/SIWESignerViem.ts:34](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum-viem/src/SIWESignerViem.ts#L34)

***

### log

> **`private`** **`readonly`** **log**: `Logger`

#### Source

[packages/chain-ethereum-viem/src/SIWESignerViem.ts:38](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum-viem/src/SIWESignerViem.ts#L38)

***

### sessionDuration

> **`readonly`** **sessionDuration**: `null` \| `number`

#### Source

[packages/chain-ethereum-viem/src/SIWESignerViem.ts:35](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum-viem/src/SIWESignerViem.ts#L35)

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

[packages/chain-ethereum-viem/src/SIWESignerViem.ts:209](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum-viem/src/SIWESignerViem.ts#L209)

***

### getSession()

> **getSession**(`topic`, `options`): `Promise`\<[`Session`](../../interfaces/type-aliases/Session.md)\<`SIWESessionData`\>\>

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

`Promise`\<[`Session`](../../interfaces/type-aliases/Session.md)\<`SIWESessionData`\>\>

#### Implementation of

[`SessionSigner`](../../interfaces/interfaces/SessionSigner.md).[`getSession`](../../interfaces/interfaces/SessionSigner.md#getsession)

#### Source

[packages/chain-ethereum-viem/src/SIWESignerViem.ts:117](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum-viem/src/SIWESignerViem.ts#L117)

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

[packages/chain-ethereum-viem/src/SIWESignerViem.ts:88](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum-viem/src/SIWESignerViem.ts#L88)

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

[packages/chain-ethereum-viem/src/SIWESignerViem.ts:186](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum-viem/src/SIWESignerViem.ts#L186)

***

### verifySession()

> **verifySession**(`topic`, `session`): `Promise`\<`void`\>

Verify that `session.data` authorizes `session.publicKey`
to take actions on behalf of the user `${session.chain}:${session.address}`

#### Parameters

• **topic**: `string`

• **session**: [`Session`](../../interfaces/type-aliases/Session.md)\<`SIWESessionData`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`SessionSigner`](../../interfaces/interfaces/SessionSigner.md).[`verifySession`](../../interfaces/interfaces/SessionSigner.md#verifysession)

#### Source

[packages/chain-ethereum-viem/src/SIWESignerViem.ts:90](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/chain-ethereum-viem/src/SIWESignerViem.ts#L90)
