[Documentation](../../../packages.md) / [@canvas-js/interfaces](../index.md) / Signer

# Interface: Signer\<Payload\>

## Type Parameters

• **Payload** = `unknown`

## Properties

### publicKey

> **publicKey**: `string`

#### Defined in

[Signer.ts:15](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/Signer.ts#L15)

***

### scheme

> **scheme**: [`SignatureScheme`](SignatureScheme.md)\<`Payload`\>

#### Defined in

[Signer.ts:13](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/Signer.ts#L13)

## Methods

### export()

> **export**(): `object`

#### Returns

`object`

##### privateKey

> **privateKey**: `Uint8Array`

##### type

> **type**: `string`

#### Defined in

[Signer.ts:19](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/Signer.ts#L19)

***

### sign()

> **sign**(`message`, `options`?): [`Awaitable`](../type-aliases/Awaitable.md)\<[`Signature`](../type-aliases/Signature.md)\>

#### Parameters

• **message**: [`Message`](../type-aliases/Message.md)\<`Payload`\>

• **options?**

• **options.codec?**: `string`

#### Returns

[`Awaitable`](../type-aliases/Awaitable.md)\<[`Signature`](../type-aliases/Signature.md)\>

#### Defined in

[Signer.ts:17](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/Signer.ts#L17)
