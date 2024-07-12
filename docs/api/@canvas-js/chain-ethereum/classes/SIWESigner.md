[Documentation](../../../packages.md) / [@canvas-js/chain-ethereum](../index.md) / SIWESigner

# Class: SIWESigner

## Extends

- `AbstractSessionSigner`\<`SIWESessionData`\>

## Constructors

### new SIWESigner()

> **new SIWESigner**(`__namedParameters`): [`SIWESigner`](SIWESigner.md)

#### Parameters

• **\_\_namedParameters**: [`SIWESignerInit`](../interfaces/SIWESignerInit.md) = `...`

#### Returns

[`SIWESigner`](SIWESigner.md)

#### Overrides

`AbstractSessionSigner<SIWESessionData>.constructor`

#### Defined in

[chain-ethereum/src/siwe/SIWESigner.ts:36](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/siwe/SIWESigner.ts#L36)

## Properties

### \_signer

> **\_signer**: `AbstractSigner`

#### Defined in

[chain-ethereum/src/siwe/SIWESigner.ts:34](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/siwe/SIWESigner.ts#L34)

***

### chainId

> `readonly` **chainId**: `number`

#### Defined in

[chain-ethereum/src/siwe/SIWESigner.ts:32](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/siwe/SIWESigner.ts#L32)

***

### key

> `readonly` **key**: `string`

#### Overrides

`AbstractSessionSigner.key`

#### Defined in

[chain-ethereum/src/siwe/SIWESigner.ts:31](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/siwe/SIWESigner.ts#L31)

***

### log

> `protected` `readonly` **log**: `Logger`

#### Inherited from

`AbstractSessionSigner.log`

#### Defined in

signatures/lib/AbstractSessionSigner.d.ts:17

***

### scheme

> `readonly` **scheme**: [`SignatureScheme`](../../interfaces/interfaces/SignatureScheme.md)\<[`Session`](../../interfaces/type-aliases/Session.md)\<`SIWESessionData`\> \| [`Action`](../../interfaces/type-aliases/Action.md)\>

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

## Methods

### authorize()

> **authorize**(`sessionData`): `Promise`\<[`Session`](../../interfaces/type-aliases/Session.md)\<`SIWESessionData`\>\>

#### Parameters

• **sessionData**: [`AbstractSessionData`](../../interfaces/interfaces/AbstractSessionData.md)

#### Returns

`Promise`\<[`Session`](../../interfaces/type-aliases/Session.md)\<`SIWESessionData`\>\>

#### Overrides

`AbstractSessionSigner.authorize`

#### Defined in

[chain-ethereum/src/siwe/SIWESigner.ts:58](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/siwe/SIWESigner.ts#L58)

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

[chain-ethereum/src/siwe/SIWESigner.ts:53](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/siwe/SIWESigner.ts#L53)

***

### getDid()

> **getDid**(): `Promise`\<\`did:$\{string\}\`\>

#### Returns

`Promise`\<\`did:$\{string\}\`\>

#### Overrides

`AbstractSessionSigner.getDid`

#### Defined in

[chain-ethereum/src/siwe/SIWESigner.ts:44](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/siwe/SIWESigner.ts#L44)

***

### getDidParts()

> **getDidParts**(): `number`

#### Returns

`number`

#### Overrides

`AbstractSessionSigner.getDidParts`

#### Defined in

[chain-ethereum/src/siwe/SIWESigner.ts:49](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/siwe/SIWESigner.ts#L49)

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

[chain-ethereum/src/siwe/SIWESigner.ts:29](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/siwe/SIWESigner.ts#L29)

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

signatures/lib/AbstractSessionSigner.d.ts:26

***

### verifySession()

> **verifySession**(`topic`, `session`): `void`

#### Parameters

• **topic**: `string`

• **session**: [`Session`](../../interfaces/type-aliases/Session.md)\<`SIWESessionData`\>

#### Returns

`void`

#### Overrides

`AbstractSessionSigner.verifySession`

#### Defined in

[chain-ethereum/src/siwe/SIWESigner.ts:101](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/siwe/SIWESigner.ts#L101)
