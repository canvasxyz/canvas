[Documentation](../../../packages.md) / [@canvas-js/gossiplog](../index.md) / ServiceMap

# Type Alias: ServiceMap\<Payload\>

> **ServiceMap**\<`Payload`\>: `object`

## Type Parameters

• **Payload**

## Type declaration

### dht?

> `optional` **dht**: `KadDHT`

### fetch

> **fetch**: `Fetch`

### gossiplog

> **gossiplog**: `GossipLogService`\<`Payload`\>

### identify

> **identify**: `Identify`

### ping

> **ping**: `PingService`

### pubsub

> **pubsub**: `PubSub`\<`GossipsubEvents`\>

## Defined in

[packages/gossiplog/src/interface.ts:15](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/interface.ts#L15)
