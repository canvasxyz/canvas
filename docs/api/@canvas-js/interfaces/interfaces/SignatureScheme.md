[Documentation](../../../packages.md) / [@canvas-js/interfaces](../index.md) / SignatureScheme

# Interface: SignatureScheme\<Payload\>

## Type Parameters

• **Payload** = `unknown`

## Properties

### codecs

> **codecs**: `string`[]

#### Defined in

[Signer.ts:7](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/Signer.ts#L7)

***

### create()

> **create**: (`init`?) => [`Signer`](Signer.md)\<`Payload`\>

#### Parameters

• **init?**

• **init.privateKey?**: `Uint8Array`

• **init.type?**: `string`

#### Returns

[`Signer`](Signer.md)\<`Payload`\>

#### Defined in

[Signer.ts:9](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/Signer.ts#L9)

***

### type

> **type**: `string`

#### Defined in

[Signer.ts:6](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/Signer.ts#L6)

***

### verify()

> **verify**: (`signature`, `message`) => [`Awaitable`](../type-aliases/Awaitable.md)\<`void`\>

#### Parameters

• **signature**: [`Signature`](../type-aliases/Signature.md)

• **message**: [`Message`](../type-aliases/Message.md)\<`Payload`\>

#### Returns

[`Awaitable`](../type-aliases/Awaitable.md)\<`void`\>

#### Defined in

[Signer.ts:8](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/interfaces/src/Signer.ts#L8)
