[Documentation](../../../index.md) / [@canvas-js/gossiplog](../index.md) / GossipLogInit

# Interface: GossipLogInit\<Payload, Result\>

## Type parameters

• **Payload** = `unknown`

• **Result** = `void`

## Properties

### apply

> **apply**: [`GossipLogConsumer`](../type-aliases/GossipLogConsumer.md)\<`Payload`, `Result`\>

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:56](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L56)

***

### indexAncestors?

> **`optional`** **indexAncestors**: `boolean`

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:60](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L60)

***

### signer?

> **`optional`** **signer**: [`Signer`](../../interfaces/interfaces/Signer.md)\<[`Message`](../type-aliases/Message.md)\<`Payload`\>\>

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:59](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L59)

***

### topic

> **topic**: `string`

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:55](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L55)

***

### validate

> **validate**: `Object` \| (`payload`) => `payload is Payload`

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:57](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L57)
