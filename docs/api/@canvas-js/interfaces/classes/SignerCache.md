[Documentation](../../../index.md) / [@canvas-js/interfaces](../index.md) / SignerCache

# Class: SignerCache

## Constructors

### new SignerCache(signers)

> **new SignerCache**(`signers`): [`SignerCache`](SignerCache.md)

#### Parameters

• **signers**: [`SessionSigner`](../interfaces/SessionSigner.md)\<`any`\>[]= `[]`

#### Returns

[`SignerCache`](SignerCache.md)

#### Source

[SignerCache.ts:7](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/interfaces/src/SignerCache.ts#L7)

## Properties

### default

> **`private`** **default**: `undefined` \| `string`

#### Source

[SignerCache.ts:5](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/interfaces/src/SignerCache.ts#L5)

***

### signers

> **signers**: [`SessionSigner`](../interfaces/SessionSigner.md)\<`any`\>[]

#### Source

[SignerCache.ts:4](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/interfaces/src/SignerCache.ts#L4)

## Methods

### getAll()

> **getAll**(): [`SessionSigner`](../interfaces/SessionSigner.md)\<`any`\>[]

#### Returns

[`SessionSigner`](../interfaces/SessionSigner.md)\<`any`\>[]

#### Source

[SignerCache.ts:21](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/interfaces/src/SignerCache.ts#L21)

***

### getFirst()

> **getFirst**(): [`SessionSigner`](../interfaces/SessionSigner.md)\<`any`\>

#### Returns

[`SessionSigner`](../interfaces/SessionSigner.md)\<`any`\>

#### Source

[SignerCache.ts:25](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/interfaces/src/SignerCache.ts#L25)

***

### updateSigners()

> **updateSigners**(`signers`): `void`

#### Parameters

• **signers**: [`SessionSigner`](../interfaces/SessionSigner.md)\<`any`\>[]

#### Returns

`void`

#### Source

[SignerCache.ts:14](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/interfaces/src/SignerCache.ts#L14)
