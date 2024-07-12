[Documentation](../../../packages.md) / [@canvas-js/interfaces](../index.md) / SignerCache

# Class: SignerCache

## Constructors

### new SignerCache()

> **new SignerCache**(`signers`): [`SignerCache`](SignerCache.md)

#### Parameters

• **signers**: [`SessionSigner`](../interfaces/SessionSigner.md)\<`any`\>[] = `[]`

#### Returns

[`SignerCache`](SignerCache.md)

#### Defined in

[SignerCache.ts:7](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/SignerCache.ts#L7)

## Properties

### signers

> **signers**: [`SessionSigner`](../interfaces/SessionSigner.md)\<`any`\>[]

#### Defined in

[SignerCache.ts:4](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/SignerCache.ts#L4)

## Methods

### getAll()

> **getAll**(): [`SessionSigner`](../interfaces/SessionSigner.md)\<`any`\>[]

#### Returns

[`SessionSigner`](../interfaces/SessionSigner.md)\<`any`\>[]

#### Defined in

[SignerCache.ts:21](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/SignerCache.ts#L21)

***

### getFirst()

> **getFirst**(): [`SessionSigner`](../interfaces/SessionSigner.md)\<`any`\>

#### Returns

[`SessionSigner`](../interfaces/SessionSigner.md)\<`any`\>

#### Defined in

[SignerCache.ts:25](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/SignerCache.ts#L25)

***

### updateSigners()

> **updateSigners**(`signers`): `void`

#### Parameters

• **signers**: [`SessionSigner`](../interfaces/SessionSigner.md)\<`any`\>[]

#### Returns

`void`

#### Defined in

[SignerCache.ts:14](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/SignerCache.ts#L14)
