[Documentation](../../../index.md) / [@canvas-js/gossiplog](../index.md) / GossipLogEvents

# Type alias: GossipLogEvents\<Payload, Result\>

> **GossipLogEvents**\<`Payload`, `Result`\>: `Object`

## Type parameters

• **Payload** = `unknown`

• **Result** = `void`

## Type declaration

### commit

> **commit**: `CustomEvent`\<`Object`\>

#### Type declaration

##### root

> **root**: `Node`

### error

> **error**: `CustomEvent`\<`Object`\>

#### Type declaration

##### error

> **error**: `Error`

### message

> **message**: `CustomEvent`\<`Object`\>

#### Type declaration

##### id

> **id**: `string`

##### message

> **message**: [`Message`](Message.md)\<`Payload`\>

##### result

> **result**: `Result`

##### signature

> **signature**: [`Signature`](../../interfaces/type-aliases/Signature.md)

### sync

> **sync**: `CustomEvent`\<`Object`\>

#### Type declaration

##### duration

> **duration**: `number`

##### messageCount

> **messageCount**: `number`

##### peer?

> **`optional`** **peer**: `string`

## Source

[packages/gossiplog/src/AbstractGossipLog.ts:63](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L63)
