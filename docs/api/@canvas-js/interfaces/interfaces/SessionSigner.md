[Documentation](../../../index.md) / [@canvas-js/interfaces](../index.md) / SessionSigner

# Interface: SessionSigner\<AuthorizationData\>

## Extends

- [`Signer`](Signer.md)\<[`Message`](../type-aliases/Message.md)\<[`Action`](../type-aliases/Action.md) \| [`Session`](../type-aliases/Session.md)\<`AuthorizationData`\>\>\>

## Type parameters

• **AuthorizationData** = `any`

## Properties

### getSession

> **getSession**: (`topic`, `options`?) => [`Awaitable`](../type-aliases/Awaitable.md)\<[`Session`](../type-aliases/Session.md)\<`AuthorizationData`\>\>

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

• **options?**

• **options\.chain?**: `string`

• **options\.fromCache?**: `boolean`

• **options\.timestamp?**: `number`

#### Returns

[`Awaitable`](../type-aliases/Awaitable.md)\<[`Session`](../type-aliases/Session.md)\<`AuthorizationData`\>\>

#### Source

[SessionSigner.ts:24](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/interfaces/src/SessionSigner.ts#L24)

***

### key

> **key**: `string`

A unique identifier based on the signer's arguments, used to trigger React effects.
This should not change unless user-provided arguments to the signers change.

For example, the key for `new SIWESigner()` should always remain the same, even if
a different burner wallet is generated on every call.

#### Source

[SessionSigner.ts:44](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/interfaces/src/SessionSigner.ts#L44)

***

### match

> **match**: (`chain`) => `boolean`

#### Parameters

• **chain**: `string`

#### Returns

`boolean`

#### Source

[SessionSigner.ts:8](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/interfaces/src/SessionSigner.ts#L8)

***

### verifySession

> **verifySession**: (`topic`, `session`) => [`Awaitable`](../type-aliases/Awaitable.md)\<`void`\>

Verify that `session.data` authorizes `session.publicKey`
to take actions on behalf of the user `${session.chain}:${session.address}`

#### Parameters

• **topic**: `string`

• **session**: [`Session`](../type-aliases/Session.md)\<`AuthorizationData`\>

#### Returns

[`Awaitable`](../type-aliases/Awaitable.md)\<`void`\>

#### Source

[SessionSigner.ts:33](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/interfaces/src/SessionSigner.ts#L33)

## Methods

### clear()

> **clear**(`topic`): [`Awaitable`](../type-aliases/Awaitable.md)\<`void`\>

#### Parameters

• **topic**: `string`

#### Returns

[`Awaitable`](../type-aliases/Awaitable.md)\<`void`\>

#### Source

[SessionSigner.ts:35](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/interfaces/src/SessionSigner.ts#L35)

***

### sign()

> **sign**(`value`): [`Signature`](../type-aliases/Signature.md)

#### Parameters

• **value**: [`Message`](../type-aliases/Message.md)\<[`Action`](../type-aliases/Action.md) \| [`Session`](../type-aliases/Session.md)\<`AuthorizationData`\>\>

#### Returns

[`Signature`](../type-aliases/Signature.md)

#### Inherited from

[`Signer`](Signer.md).[`sign`](Signer.md#sign)

#### Source

[Signer.ts:4](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/interfaces/src/Signer.ts#L4)
