[Documentation](../../../packages.md) / [@canvas-js/chain-substrate](../index.md) / SubstrateSigner

# Class: SubstrateSigner

## Extends

- `AbstractSessionSigner`\<`SubstrateSessionData`\>

## Constructors

### new SubstrateSigner()

> **new SubstrateSigner**(`__namedParameters`): [`SubstrateSigner`](SubstrateSigner.md)

#### Parameters

• **\_\_namedParameters**: `SubstrateSignerInit` = `...`

#### Returns

[`SubstrateSigner`](SubstrateSigner.md)

#### Overrides

`AbstractSessionSigner<SubstrateSessionData>.constructor`

#### Defined in

[chain-substrate/src/SubstrateSigner.ts:44](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-substrate/src/SubstrateSigner.ts#L44)

## Properties

### \_signer

> **\_signer**: `AbstractSigner`

#### Defined in

[chain-substrate/src/SubstrateSigner.ts:42](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-substrate/src/SubstrateSigner.ts#L42)

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

> `readonly` **scheme**: [`SignatureScheme`](../../interfaces/interfaces/SignatureScheme.md)\<[`Session`](../../interfaces/type-aliases/Session.md)\<`SubstrateSessionData`\> \| [`Action`](../../interfaces/type-aliases/Action.md)\>

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

> **authorize**(`data`): `Promise`\<[`Session`](../../interfaces/type-aliases/Session.md)\<`SubstrateSessionData`\>\>

#### Parameters

• **data**: [`AbstractSessionData`](../../interfaces/interfaces/AbstractSessionData.md)

#### Returns

`Promise`\<[`Session`](../../interfaces/type-aliases/Session.md)\<`SubstrateSessionData`\>\>

#### Overrides

`AbstractSessionSigner.authorize`

#### Defined in

[chain-substrate/src/SubstrateSigner.ts:193](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-substrate/src/SubstrateSigner.ts#L193)

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

> **getAddressFromDid**(`did`): `string`

#### Parameters

• **did**: \`did:$\{string\}\`

#### Returns

`string`

#### Overrides

`AbstractSessionSigner.getAddressFromDid`

#### Defined in

[chain-substrate/src/SubstrateSigner.ts:188](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-substrate/src/SubstrateSigner.ts#L188)

***

### getDid()

> **getDid**(): `Promise`\<\`did:$\{string\}\`\>

#### Returns

`Promise`\<\`did:$\{string\}\`\>

#### Overrides

`AbstractSessionSigner.getDid`

#### Defined in

[chain-substrate/src/SubstrateSigner.ts:178](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-substrate/src/SubstrateSigner.ts#L178)

***

### getDidParts()

> **getDidParts**(): `number`

#### Returns

`number`

#### Overrides

`AbstractSessionSigner.getDidParts`

#### Defined in

[chain-substrate/src/SubstrateSigner.ts:184](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-substrate/src/SubstrateSigner.ts#L184)

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

[chain-substrate/src/SubstrateSigner.ts:38](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-substrate/src/SubstrateSigner.ts#L38)

***

### newSession()

> **newSession**(`topic`): `Promise`\<`object`\>

#### Parameters

• **topic**: `string`

#### Returns

`Promise`\<`object`\>

##### payload

> **payload**: [`Session`](../../interfaces/type-aliases/Session.md)\<`SubstrateSessionData`\>

##### signer

> **signer**: [`Signer`](../../interfaces/interfaces/Signer.md)\<[`Session`](../../interfaces/type-aliases/Session.md)\<`SubstrateSessionData`\> \| [`Action`](../../interfaces/type-aliases/Action.md)\>

#### Inherited from

`AbstractSessionSigner.newSession`

#### Defined in

signatures/lib/AbstractSessionSigner.d.ts:26

***

### verifySession()

> **verifySession**(`topic`, `session`): `Promise`\<`void`\>

#### Parameters

• **topic**: `string`

• **session**: [`Session`](../../interfaces/type-aliases/Session.md)

#### Returns

`Promise`\<`void`\>

#### Overrides

`AbstractSessionSigner.verifySession`

#### Defined in

[chain-substrate/src/SubstrateSigner.ts:138](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-substrate/src/SubstrateSigner.ts#L138)
