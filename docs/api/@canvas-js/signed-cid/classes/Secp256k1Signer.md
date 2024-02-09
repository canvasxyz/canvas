[Documentation](../../../index.md) / [@canvas-js/signed-cid](../index.md) / Secp256k1Signer

# Class: Secp256k1Signer\<T\>

## Type parameters

• **T** = `any`

## Implements

- [`Signer`](../interfaces/Signer.md)\<`T`\>

## Constructors

### new Secp256k1Signer(privateKey)

> **new Secp256k1Signer**\<`T`\>(`privateKey`): [`Secp256k1Signer`](Secp256k1Signer.md)\<`T`\>

#### Parameters

• **privateKey**: `Uint8Array`= `undefined`

33-byte secp256k1 private key

#### Returns

[`Secp256k1Signer`](Secp256k1Signer.md)\<`T`\>

#### Source

[signed-cid/src/Secp256k1Signer.ts:21](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/signed-cid/src/Secp256k1Signer.ts#L21)

## Properties

### #privateKey

> **`private`** **`readonly`** **#privateKey**: `Uint8Array`

#### Source

[signed-cid/src/Secp256k1Signer.ts:16](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/signed-cid/src/Secp256k1Signer.ts#L16)

***

### uri

> **`readonly`** **uri**: `string`

#### Source

[signed-cid/src/Secp256k1Signer.ts:15](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/signed-cid/src/Secp256k1Signer.ts#L15)

***

### code

> **`static`** **code**: `number` = `0xe7`

#### Source

[signed-cid/src/Secp256k1Signer.ts:13](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/signed-cid/src/Secp256k1Signer.ts#L13)

***

### type

> **`static`** **type**: `"secp256k1"`

#### Source

[signed-cid/src/Secp256k1Signer.ts:12](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/signed-cid/src/Secp256k1Signer.ts#L12)

## Methods

### export()

> **export**(): `Object`

#### Returns

`Object`

##### privateKey

> **privateKey**: `Uint8Array`

##### type

> **type**: `"secp256k1"`

#### Source

[signed-cid/src/Secp256k1Signer.ts:40](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/signed-cid/src/Secp256k1Signer.ts#L40)

***

### sign()

> **sign**(`value`, `options`): [`Signature`](../type-aliases/Signature.md)

#### Parameters

• **value**: `T`

• **options**= `{}`

• **options\.codec?**: `string` \| [`Codec`](../type-aliases/Codec.md)

• **options\.digest?**: `string` \| [`Digest`](../type-aliases/Digest.md)

#### Returns

[`Signature`](../type-aliases/Signature.md)

#### Implementation of

[`Signer`](../interfaces/Signer.md).[`sign`](../interfaces/Signer.md#sign)

#### Source

[signed-cid/src/Secp256k1Signer.ts:34](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/signed-cid/src/Secp256k1Signer.ts#L34)
