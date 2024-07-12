[Documentation](../../../packages.md) / [@canvas-js/chain-ethereum-viem](../index.md) / SIWESignerViem

# Class: SIWESignerViem

## Extends

- `AbstractSessionSigner`\<`SIWESessionData`\>

## Constructors

### new SIWESignerViem()

> **new SIWESignerViem**(`__namedParameters`): [`SIWESignerViem`](SIWESignerViem.md)

#### Parameters

• **\_\_namedParameters**: [`SIWESignerViemInit`](../interfaces/SIWESignerViemInit.md) = `{}`

#### Returns

[`SIWESignerViem`](SIWESignerViem.md)

#### Overrides

`AbstractSessionSigner<SIWESessionData>.constructor`

#### Defined in

[packages/chain-ethereum-viem/src/SIWESignerViem.ts:32](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum-viem/src/SIWESignerViem.ts#L32)

## Properties

### chainId

> `readonly` **chainId**: `number`

#### Defined in

[packages/chain-ethereum-viem/src/SIWESignerViem.ts:25](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum-viem/src/SIWESignerViem.ts#L25)

***

### key

> `readonly` **key**: `string`

A unique identifier based on the signer's arguments, used to trigger React effects.
This should not change unless user-provided arguments to the signers change.

For example, the key for `new SIWESigner()` should always remain the same, even if
a different burner wallet is generated on every call.

#### Inherited from

`AbstractSessionSigner.key`

#### Defined in

packages/signatures/lib/AbstractSessionSigner.d.ts:8

***

### log

> `protected` `readonly` **log**: `Logger`

#### Inherited from

`AbstractSessionSigner.log`

#### Defined in

packages/signatures/lib/AbstractSessionSigner.d.ts:17

***

### scheme

> `readonly` **scheme**: [`SignatureScheme`](../../interfaces/interfaces/SignatureScheme.md)\<[`Session`](../../interfaces/type-aliases/Session.md)\<`SIWESessionData`\> \| [`Action`](../../interfaces/type-aliases/Action.md)\>

#### Inherited from

`AbstractSessionSigner.scheme`

#### Defined in

packages/signatures/lib/AbstractSessionSigner.d.ts:9

***

### sessionDuration

> `readonly` **sessionDuration**: `null` \| `number`

#### Inherited from

`AbstractSessionSigner.sessionDuration`

#### Defined in

packages/signatures/lib/AbstractSessionSigner.d.ts:16

***

### target

> `readonly` **target**: `object`

#### clear()

##### Parameters

• **prefix?**: `string`

##### Returns

`void`

#### get()

##### Parameters

• **key**: `string`

##### Returns

`null` \| `string`

#### getDomain()

##### Returns

`string`

#### set()

##### Parameters

• **key**: `string`

• **value**: `any`

##### Returns

`void`

#### Inherited from

`AbstractSessionSigner.target`

#### Defined in

packages/signatures/lib/AbstractSessionSigner.d.ts:10

## Methods

### authorize()

> **authorize**(`data`): `Promise`\<[`Session`](../../interfaces/type-aliases/Session.md)\<`SIWESessionData`\>\>

#### Parameters

• **data**: [`AbstractSessionData`](../../interfaces/interfaces/AbstractSessionData.md)

#### Returns

`Promise`\<[`Session`](../../interfaces/type-aliases/Session.md)\<`SIWESessionData`\>\>

#### Overrides

`AbstractSessionSigner.authorize`

#### Defined in

[packages/chain-ethereum-viem/src/SIWESignerViem.ts:121](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum-viem/src/SIWESignerViem.ts#L121)

***

### clear()

> **clear**(`topic`): `Promise`\<`void`\>

#### Parameters

• **topic**: `string`

#### Returns

`Promise`\<`void`\>

#### Inherited from

`AbstractSessionSigner.clear`

#### Defined in

packages/signatures/lib/AbstractSessionSigner.d.ts:37

***

### getAddressFromDid()

> **getAddressFromDid**(`did`): `string`

#### Parameters

• **did**: \`did:$\{string\}\`

#### Returns

`string`

#### Overrides

`AbstractSessionSigner.getAddressFromDid`

#### Defined in

[packages/chain-ethereum-viem/src/SIWESignerViem.ts:116](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum-viem/src/SIWESignerViem.ts#L116)

***

### getDid()

> **getDid**(): `Promise`\<\`did:$\{string\}\`\>

#### Returns

`Promise`\<\`did:$\{string\}\`\>

#### Overrides

`AbstractSessionSigner.getDid`

#### Defined in

[packages/chain-ethereum-viem/src/SIWESignerViem.ts:107](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum-viem/src/SIWESignerViem.ts#L107)

***

### getDidParts()

> **getDidParts**(): `number`

#### Returns

`number`

#### Overrides

`AbstractSessionSigner.getDidParts`

#### Defined in

[packages/chain-ethereum-viem/src/SIWESignerViem.ts:112](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum-viem/src/SIWESignerViem.ts#L112)

***

### getSession()

> **getSession**(`topic`, `options`?): `Promise`\<`null` \| `object`\>

#### Parameters

• **topic**: `string`

• **options?**

• **options.did?**: `string`

#### Returns

`Promise`\<`null` \| `object`\>

#### Inherited from

`AbstractSessionSigner.getSession`

#### Defined in

packages/signatures/lib/AbstractSessionSigner.d.ts:30

***

### getWalletAddress()

> **getWalletAddress**(): `Promise`\<`string`\>

#### Returns

`Promise`\<`string`\>

#### Inherited from

`AbstractSessionSigner.getWalletAddress`

#### Defined in

packages/signatures/lib/AbstractSessionSigner.d.ts:24

***

### hasSession()

> **hasSession**(`topic`, `did`): `boolean`

#### Parameters

• **topic**: `string`

• **did**: \`did:$\{string\}\`

#### Returns

`boolean`

#### Inherited from

`AbstractSessionSigner.hasSession`

#### Defined in

packages/signatures/lib/AbstractSessionSigner.d.ts:36

***

### match()

> `readonly` **match**(`address`): `boolean`

#### Parameters

• **address**: `string`

#### Returns

`boolean`

#### Overrides

`AbstractSessionSigner.match`

#### Defined in

[packages/chain-ethereum-viem/src/SIWESignerViem.ts:24](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum-viem/src/SIWESignerViem.ts#L24)

***

### newSession()

> **newSession**(`topic`): `Promise`\<`object`\>

#### Parameters

• **topic**: `string`

#### Returns

`Promise`\<`object`\>

##### payload

> **payload**: [`Session`](../../interfaces/type-aliases/Session.md)\<`SIWESessionData`\>

##### signer

> **signer**: [`Signer`](../../interfaces/interfaces/Signer.md)\<[`Session`](../../interfaces/type-aliases/Session.md)\<`SIWESessionData`\> \| [`Action`](../../interfaces/type-aliases/Action.md)\>

#### Inherited from

`AbstractSessionSigner.newSession`

#### Defined in

packages/signatures/lib/AbstractSessionSigner.d.ts:26

***

### verifySession()

> **verifySession**(`topic`, `session`): `Promise`\<`void`\>

#### Parameters

• **topic**: `string`

• **session**: [`Session`](../../interfaces/type-aliases/Session.md)\<`SIWESessionData`\>

#### Returns

`Promise`\<`void`\>

#### Overrides

`AbstractSessionSigner.verifySession`

#### Defined in

[packages/chain-ethereum-viem/src/SIWESignerViem.ts:75](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum-viem/src/SIWESignerViem.ts#L75)
