[Documentation](../../../index.md) / [@canvas-js/signed-cid](../index.md) / Ed25519Signer

# Class: Ed25519Signer\<T\>

## Type parameters

• **T** = `any`

## Implements

- [`Signer`](../interfaces/Signer.md)\<`T`\>

## Constructors

### new Ed25519Signer(privateKey)

> **new Ed25519Signer**\<`T`\>(`privateKey`): [`Ed25519Signer`](Ed25519Signer.md)\<`T`\>

#### Parameters

• **privateKey**: `Uint8Array`= `undefined`

32-byte ed25519 private key

#### Returns

[`Ed25519Signer`](Ed25519Signer.md)\<`T`\>

#### Source

[signed-cid/src/Ed25519Signer.ts:21](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/signed-cid/src/Ed25519Signer.ts#L21)

## Properties

### #privateKey

> **`private`** **`readonly`** **#privateKey**: `Uint8Array`

#### Source

[signed-cid/src/Ed25519Signer.ts:16](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/signed-cid/src/Ed25519Signer.ts#L16)

***

### uri

> **`readonly`** **uri**: `string`

#### Source

[signed-cid/src/Ed25519Signer.ts:15](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/signed-cid/src/Ed25519Signer.ts#L15)

***

### code

> **`static`** **code**: `number` = `0xed`

#### Source

[signed-cid/src/Ed25519Signer.ts:13](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/signed-cid/src/Ed25519Signer.ts#L13)

***

### type

> **`static`** **type**: `"ed25519"`

#### Source

[signed-cid/src/Ed25519Signer.ts:12](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/signed-cid/src/Ed25519Signer.ts#L12)

## Methods

### export()

> **export**(): `Object`

#### Returns

`Object`

##### privateKey

> **privateKey**: `Uint8Array`

##### type

> **type**: `"ed25519"`

#### Source

[signed-cid/src/Ed25519Signer.ts:38](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/signed-cid/src/Ed25519Signer.ts#L38)

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

[signed-cid/src/Ed25519Signer.ts:32](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/signed-cid/src/Ed25519Signer.ts#L32)
