[Documentation](../../../packages.md) / [@canvas-js/gossiplog](../index.md) / GossipLogInit

# Interface: GossipLogInit\<Payload\>

## Type Parameters

• **Payload** = `unknown`

## Properties

### apply

> **apply**: [`GossipLogConsumer`](../type-aliases/GossipLogConsumer.md)\<`Payload`\>

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:29](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L29)

***

### rebuildMerkleIndex?

> `optional` **rebuildMerkleIndex**: `boolean`

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:34](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L34)

***

### signer?

> `optional` **signer**: [`Signer`](../../interfaces/interfaces/Signer.md)\<`Payload`\>

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:33](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L33)

***

### topic

> **topic**: `string`

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:28](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L28)

***

### validatePayload()?

> `optional` **validatePayload**: (`payload`) => `payload is Payload`

#### Parameters

• **payload**: `unknown`

#### Returns

`payload is Payload`

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:30](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L30)

***

### verifySignature()?

> `optional` **verifySignature**: (`signature`, `message`) => [`Awaitable`](../../interfaces/type-aliases/Awaitable.md)\<`void`\>

#### Parameters

• **signature**: [`Signature`](../../interfaces/type-aliases/Signature.md)

• **message**: [`Message`](../type-aliases/Message.md)\<`Payload`\>

#### Returns

[`Awaitable`](../../interfaces/type-aliases/Awaitable.md)\<`void`\>

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:31](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L31)
