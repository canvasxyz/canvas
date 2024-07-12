[Documentation](../../../packages.md) / [@canvas-js/chain-ethereum](../index.md) / Eip712Signer

# Class: Eip712Signer

## Extends

- `AbstractSessionSigner`\<`Eip712SessionData`\>

## Constructors

### new Eip712Signer()

> **new Eip712Signer**(`init`): [`Eip712Signer`](Eip712Signer.md)

#### Parameters

• **init** = `...`

• **init.chainId?**: `number`

• **init.sessionDuration?**: `number`

• **init.signer?**: `AbstractSigner`\<`null` \| `Provider`\>

#### Returns

[`Eip712Signer`](Eip712Signer.md)

#### Overrides

`AbstractSessionSigner<Eip712SessionData>.constructor`

#### Defined in

[chain-ethereum/src/eip712/Eip712Signer.ts:30](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/eip712/Eip712Signer.ts#L30)

## Properties

### \_signer

> **\_signer**: `AbstractSigner`\<`null` \| `Provider`\>

#### Defined in

[chain-ethereum/src/eip712/Eip712Signer.ts:28](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/eip712/Eip712Signer.ts#L28)

***

### chainId

> `readonly` **chainId**: `number`

#### Defined in

[chain-ethereum/src/eip712/Eip712Signer.ts:27](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/eip712/Eip712Signer.ts#L27)

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

signatures/lib/AbstractSessionSigner.d.ts:8

***

### log

> `protected` `readonly` **log**: `Logger`

#### Inherited from

`AbstractSessionSigner.log`

#### Defined in

signatures/lib/AbstractSessionSigner.d.ts:17

***

### scheme

> `readonly` **scheme**: [`SignatureScheme`](../../interfaces/interfaces/SignatureScheme.md)\<[`Action`](../../interfaces/type-aliases/Action.md) \| [`Session`](../../interfaces/type-aliases/Session.md)\<`Eip712SessionData`\>\>

#### Inherited from

`AbstractSessionSigner.scheme`

#### Defined in

signatures/lib/AbstractSessionSigner.d.ts:9

***

### sessionDuration

> `readonly` **sessionDuration**: `null` \| `number`

#### Inherited from

`AbstractSessionSigner.sessionDuration`

#### Defined in

signatures/lib/AbstractSessionSigner.d.ts:16

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

signatures/lib/AbstractSessionSigner.d.ts:10

***

### sessionDataTypes

> `static` **sessionDataTypes**: `object`

#### SessionData

> **SessionData**: `object`[]

#### Defined in

[chain-ethereum/src/eip712/Eip712Signer.ts:15](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/eip712/Eip712Signer.ts#L15)

## Methods

### authorize()

> **authorize**(`sessionData`): `Promise`\<[`Session`](../../interfaces/type-aliases/Session.md)\<`Eip712SessionData`\>\>

#### Parameters

• **sessionData**: [`AbstractSessionData`](../../interfaces/interfaces/AbstractSessionData.md)

#### Returns

`Promise`\<[`Session`](../../interfaces/type-aliases/Session.md)\<`Eip712SessionData`\>\>

#### Overrides

`AbstractSessionSigner.authorize`

#### Defined in

[chain-ethereum/src/eip712/Eip712Signer.ts:52](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/eip712/Eip712Signer.ts#L52)

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

signatures/lib/AbstractSessionSigner.d.ts:37

***

### getAddressFromDid()

> **getAddressFromDid**(`did`): \`0x$\{string\}\`

#### Parameters

• **did**: \`did:$\{string\}\`

#### Returns

\`0x$\{string\}\`

#### Overrides

`AbstractSessionSigner.getAddressFromDid`

#### Defined in

[chain-ethereum/src/eip712/Eip712Signer.ts:47](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/eip712/Eip712Signer.ts#L47)

***

### getDid()

> **getDid**(): `Promise`\<\`did:$\{string\}\`\>

#### Returns

`Promise`\<\`did:$\{string\}\`\>

#### Overrides

`AbstractSessionSigner.getDid`

#### Defined in

[chain-ethereum/src/eip712/Eip712Signer.ts:38](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/eip712/Eip712Signer.ts#L38)

***

### getDidParts()

> **getDidParts**(): `number`

#### Returns

`number`

#### Overrides

`AbstractSessionSigner.getDidParts`

#### Defined in

[chain-ethereum/src/eip712/Eip712Signer.ts:43](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/eip712/Eip712Signer.ts#L43)

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

signatures/lib/AbstractSessionSigner.d.ts:30

***

### getWalletAddress()

> **getWalletAddress**(): `Promise`\<`string`\>

#### Returns

`Promise`\<`string`\>

#### Inherited from

`AbstractSessionSigner.getWalletAddress`

#### Defined in

signatures/lib/AbstractSessionSigner.d.ts:24

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

signatures/lib/AbstractSessionSigner.d.ts:36

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

[chain-ethereum/src/eip712/Eip712Signer.ts:25](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/eip712/Eip712Signer.ts#L25)

***

### newSession()

> **newSession**(`topic`): `Promise`\<`object`\>

#### Parameters

• **topic**: `string`

#### Returns

`Promise`\<`object`\>

##### payload

> **payload**: [`Session`](../../interfaces/type-aliases/Session.md)\<`Eip712SessionData`\>

##### signer

> **signer**: [`Signer`](../../interfaces/interfaces/Signer.md)\<[`Action`](../../interfaces/type-aliases/Action.md) \| [`Session`](../../interfaces/type-aliases/Session.md)\<`Eip712SessionData`\>\>

#### Inherited from

`AbstractSessionSigner.newSession`

#### Defined in

signatures/lib/AbstractSessionSigner.d.ts:26

***

### verifySession()

> **verifySession**(`topic`, `session`): `void`

#### Parameters

• **topic**: `string`

• **session**: [`Session`](../../interfaces/type-aliases/Session.md)\<`Eip712SessionData`\>

#### Returns

`void`

#### Overrides

`AbstractSessionSigner.verifySession`

#### Defined in

[chain-ethereum/src/eip712/Eip712Signer.ts:82](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/eip712/Eip712Signer.ts#L82)
