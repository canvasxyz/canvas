[Documentation](../../../packages.md) / [@canvas-js/gossiplog](../index.md) / GossipLogConsumer

# Type Alias: GossipLogConsumer()\<Payload\>

> **GossipLogConsumer**\<`Payload`\>: (`this`, `{ id, signature, message }`, `branch`) => [`Awaitable`](../../interfaces/type-aliases/Awaitable.md)\<`void`\>

## Type Parameters

• **Payload** = `unknown`

## Parameters

• **this**: [`AbstractGossipLog`](../classes/AbstractGossipLog.md)\<`Payload`\>

• **\{ id, signature, message \}**: `SignedMessage`\<`Payload`\>

• **branch**: `number`

## Returns

[`Awaitable`](../../interfaces/type-aliases/Awaitable.md)\<`void`\>

## Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:21](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L21)
