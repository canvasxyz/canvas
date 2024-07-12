[Documentation](../../../packages.md) / [@canvas-js/gossiplog](../index.md) / GossipLogEvents

# Type Alias: GossipLogEvents\<Payload\>

> **GossipLogEvents**\<`Payload`\>: `object`

## Type Parameters

• **Payload** = `unknown`

## Type declaration

### commit

> **commit**: `CustomEvent`\<`object`\>

#### Type declaration

##### heads

> **heads**: `string`[]

##### root

> **root**: `Node`

### error

> **error**: `CustomEvent`\<`object`\>

#### Type declaration

##### error

> **error**: `Error`

### message

> **message**: `CustomEvent`\<`object`\>

#### Type declaration

##### id

> **id**: `string`

##### message

> **message**: [`Message`](Message.md)\<`Payload`\>

##### signature

> **signature**: [`Signature`](../../interfaces/type-aliases/Signature.md)

### sync

> **sync**: `CustomEvent`\<`object`\>

#### Type declaration

##### duration

> **duration**: `number`

##### messageCount

> **messageCount**: `number`

##### peerId?

> `optional` **peerId**: `string`

## Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:37](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L37)
