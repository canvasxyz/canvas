[Documentation](../../../packages.md) / [@canvas-js/chain-ethereum](../index.md) / Secp256k1DelegateSigner

# Class: Secp256k1DelegateSigner

Secp256k1DelegateSigner ONLY supports the following codecs:
- canvas-action-eip712
- canvas-session-eip712

## Implements

- [`Signer`](../../interfaces/interfaces/Signer.md)\<[`Action`](../../interfaces/type-aliases/Action.md) \| [`Session`](../../interfaces/type-aliases/Session.md)\<`Eip712SessionData`\>\>

## Constructors

### new Secp256k1DelegateSigner()

> **new Secp256k1DelegateSigner**(`init`?): [`Secp256k1DelegateSigner`](Secp256k1DelegateSigner.md)

#### Parameters

• **init?**

• **init.privateKey?**: `Uint8Array`

• **init.type?**: `string`

#### Returns

[`Secp256k1DelegateSigner`](Secp256k1DelegateSigner.md)

#### Defined in

[chain-ethereum/src/eip712/Secp256k1DelegateSigner.ts:71](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/eip712/Secp256k1DelegateSigner.ts#L71)

## Properties

### publicKey

> `readonly` **publicKey**: `string`

#### Implementation of

[`Signer`](../../interfaces/interfaces/Signer.md).[`publicKey`](../../interfaces/interfaces/Signer.md#publickey)

#### Defined in

[chain-ethereum/src/eip712/Secp256k1DelegateSigner.ts:67](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/eip712/Secp256k1DelegateSigner.ts#L67)

***

### scheme

> `readonly` **scheme**: [`SignatureScheme`](../../interfaces/interfaces/SignatureScheme.md)\<[`Action`](../../interfaces/type-aliases/Action.md) \| [`Session`](../../interfaces/type-aliases/Session.md)\<`Eip712SessionData`\>\> = `Secp256k1SignatureScheme`

#### Implementation of

[`Signer`](../../interfaces/interfaces/Signer.md).[`scheme`](../../interfaces/interfaces/Signer.md#scheme)

#### Defined in

[chain-ethereum/src/eip712/Secp256k1DelegateSigner.ts:66](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/eip712/Secp256k1DelegateSigner.ts#L66)

***

### eip712ActionTypes

> `static` **eip712ActionTypes**: `object`

#### Action

> **Action**: `object`[]

#### Message

> **Message**: `object`[]

#### Defined in

[chain-ethereum/src/eip712/Secp256k1DelegateSigner.ts:32](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/eip712/Secp256k1DelegateSigner.ts#L32)

***

### eip712SessionTypes

> `static` **eip712SessionTypes**: `object`

#### AuthorizationData

> **AuthorizationData**: `object`[]

#### Message

> **Message**: `object`[]

#### Session

> **Session**: `object`[]

#### Defined in

[chain-ethereum/src/eip712/Secp256k1DelegateSigner.ts:48](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/eip712/Secp256k1DelegateSigner.ts#L48)

## Methods

### export()

> **export**(): `object`

#### Returns

`object`

##### privateKey

> **privateKey**: `Uint8Array`

##### type

> **type**: `string`

#### Implementation of

[`Signer`](../../interfaces/interfaces/Signer.md).[`export`](../../interfaces/interfaces/Signer.md#export)

#### Defined in

[chain-ethereum/src/eip712/Secp256k1DelegateSigner.ts:133](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/eip712/Secp256k1DelegateSigner.ts#L133)

***

### sign()

> **sign**(`message`): `Promise`\<[`Signature`](../../interfaces/type-aliases/Signature.md)\>

#### Parameters

• **message**: [`Message`](../../gossiplog/type-aliases/Message.md)\<[`Action`](../../interfaces/type-aliases/Action.md) \| [`Session`](../../interfaces/type-aliases/Session.md)\<`Eip712SessionData`\>\>

#### Returns

`Promise`\<[`Signature`](../../interfaces/type-aliases/Signature.md)\>

#### Implementation of

[`Signer`](../../interfaces/interfaces/Signer.md).[`sign`](../../interfaces/interfaces/Signer.md#sign)

#### Defined in

[chain-ethereum/src/eip712/Secp256k1DelegateSigner.ts:83](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/chain-ethereum/src/eip712/Secp256k1DelegateSigner.ts#L83)
