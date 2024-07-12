[Documentation](../../../packages.md) / [@canvas-js/interfaces](../index.md) / SessionSigner

# Interface: SessionSigner\<AuthorizationData\>

## Type Parameters

• **AuthorizationData** = `any`

## Properties

### getAddressFromDid()

> **getAddressFromDid**: (`did`) => `string`

#### Parameters

• **did**: \`did:$\{string\}\`

#### Returns

`string`

#### Defined in

[SessionSigner.ts:24](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/SessionSigner.ts#L24)

***

### getDid()

> **getDid**: () => [`Awaitable`](../type-aliases/Awaitable.md)\<\`did:$\{string\}\`\>

#### Returns

[`Awaitable`](../type-aliases/Awaitable.md)\<\`did:$\{string\}\`\>

#### Defined in

[SessionSigner.ts:22](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/SessionSigner.ts#L22)

***

### getDidParts()

> **getDidParts**: () => `number`

#### Returns

`number`

#### Defined in

[SessionSigner.ts:23](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/SessionSigner.ts#L23)

***

### getSession()

> **getSession**: (`topic`, `options`?) => [`Awaitable`](../type-aliases/Awaitable.md)\<`null` \| `object`\>

#### Parameters

• **topic**: `string`

• **options?**

• **options.did?**: \`did:$\{string\}\`

#### Returns

[`Awaitable`](../type-aliases/Awaitable.md)\<`null` \| `object`\>

#### Defined in

[SessionSigner.ts:27](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/SessionSigner.ts#L27)

***

### hasSession()

> **hasSession**: (`topic`, `did`) => `boolean`

#### Parameters

• **topic**: `string`

• **did**: \`did:$\{string\}\`

#### Returns

`boolean`

#### Defined in

[SessionSigner.ts:26](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/SessionSigner.ts#L26)

***

### key

> **key**: `string`

A unique identifier based on the signer's arguments, used to trigger React effects.
This should not change unless user-provided arguments to the signers change.

For example, the key for `new SIWESigner()` should always remain the same, even if
a different burner wallet is generated on every call.

#### Defined in

[SessionSigner.ts:50](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/SessionSigner.ts#L50)

***

### match()

> **match**: (`did`) => `boolean`

#### Parameters

• **did**: \`did:$\{string\}\`

#### Returns

`boolean`

#### Defined in

[SessionSigner.ts:20](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/SessionSigner.ts#L20)

***

### newSession()

> **newSession**: (`topic`) => [`Awaitable`](../type-aliases/Awaitable.md)\<`object`\>

#### Parameters

• **topic**: `string`

#### Returns

[`Awaitable`](../type-aliases/Awaitable.md)\<`object`\>

##### payload

> **payload**: [`Session`](../type-aliases/Session.md)\<`AuthorizationData`\>

##### signer

> **signer**: [`Signer`](Signer.md)\<[`Action`](../type-aliases/Action.md) \| [`Session`](../type-aliases/Session.md)\<`AuthorizationData`\>\>

#### Defined in

[SessionSigner.ts:31](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/SessionSigner.ts#L31)

***

### scheme

> **scheme**: [`SignatureScheme`](SignatureScheme.md)\<[`Action`](../type-aliases/Action.md) \| [`Session`](../type-aliases/Session.md)\<`AuthorizationData`\>\>

#### Defined in

[SessionSigner.ts:19](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/SessionSigner.ts#L19)

***

### verifySession()

> **verifySession**: (`topic`, `session`) => [`Awaitable`](../type-aliases/Awaitable.md)\<`void`\>

Verify that `session.data` authorizes `session.publicKey`
to take actions on behalf of the user `session.did`

#### Parameters

• **topic**: `string`

• **session**: [`Session`](../type-aliases/Session.md)\<`AuthorizationData`\>

#### Returns

[`Awaitable`](../type-aliases/Awaitable.md)\<`void`\>

#### Defined in

[SessionSigner.ts:39](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/SessionSigner.ts#L39)

## Methods

### clear()

> **clear**(`topic`): [`Awaitable`](../type-aliases/Awaitable.md)\<`void`\>

#### Parameters

• **topic**: `string`

#### Returns

[`Awaitable`](../type-aliases/Awaitable.md)\<`void`\>

#### Defined in

[SessionSigner.ts:41](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/SessionSigner.ts#L41)
