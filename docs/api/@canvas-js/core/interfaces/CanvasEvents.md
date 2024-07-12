[Documentation](../../../packages.md) / [@canvas-js/core](../index.md) / CanvasEvents

# Interface: CanvasEvents

## Extends

- [`GossipLogEvents`](../../gossiplog/type-aliases/GossipLogEvents.md)\<[`Action`](../../interfaces/type-aliases/Action.md) \| [`Session`](../../interfaces/type-aliases/Session.md)\>

## Properties

### commit

> **commit**: `CustomEvent`\<`object`\>

#### Type declaration

##### heads

> **heads**: `string`[]

##### root

> **root**: `Node`

#### Inherited from

`GossipLogEvents.commit`

#### Defined in

packages/gossiplog/lib/AbstractGossipLog.d.ts:23

***

### connect

> **connect**: `CustomEvent`\<`object`\>

#### Type declaration

##### peer

> **peer**: `string`

#### Defined in

[packages/core/src/Canvas.ts:46](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L46)

***

### disconnect

> **disconnect**: `CustomEvent`\<`object`\>

#### Type declaration

##### peer

> **peer**: `string`

#### Defined in

[packages/core/src/Canvas.ts:47](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L47)

***

### error

> **error**: `CustomEvent`\<`object`\>

#### Type declaration

##### error

> **error**: `Error`

#### Inherited from

`GossipLogEvents.error`

#### Defined in

packages/gossiplog/lib/AbstractGossipLog.d.ts:32

***

### message

> **message**: `CustomEvent`\<`object`\>

#### Type declaration

##### id

> **id**: `string`

##### message

> **message**: [`Message`](../../gossiplog/type-aliases/Message.md)\<[`Action`](../../interfaces/type-aliases/Action.md) \| [`Session`](../../interfaces/type-aliases/Session.md)\>

##### signature

> **signature**: [`Signature`](../../interfaces/type-aliases/Signature.md)

#### Inherited from

`GossipLogEvents.message`

#### Defined in

packages/gossiplog/lib/AbstractGossipLog.d.ts:18

***

### stop

> **stop**: `Event`

#### Defined in

[packages/core/src/Canvas.ts:45](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L45)

***

### sync

> **sync**: `CustomEvent`\<`object`\>

#### Type declaration

##### duration

> **duration**: `number`

##### messageCount

> **messageCount**: `number`

##### peerId?

> `optional` **peerId**: `string`

#### Inherited from

`GossipLogEvents.sync`

#### Defined in

packages/gossiplog/lib/AbstractGossipLog.d.ts:27
