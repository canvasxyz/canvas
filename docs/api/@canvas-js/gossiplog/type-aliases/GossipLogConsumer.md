[Documentation](../../../index.md) / [@canvas-js/gossiplog](../index.md) / GossipLogConsumer

# Type alias: GossipLogConsumer\<Payload, Result\>

> **GossipLogConsumer**\<`Payload`, `Result`\>: (`id`, `signature`, `message`) => [`Awaitable`](../../interfaces/type-aliases/Awaitable.md)\<`Result`\>

## Type parameters

• **Payload** = `unknown`

• **Result** = `void`

## Parameters

• **id**: `string`

• **signature**: [`Signature`](../../interfaces/type-aliases/Signature.md)

• **message**: [`Message`](Message.md)\<`Payload`\>

## Returns

[`Awaitable`](../../interfaces/type-aliases/Awaitable.md)\<`Result`\>

## Source

[packages/gossiplog/src/AbstractGossipLog.ts:48](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L48)
