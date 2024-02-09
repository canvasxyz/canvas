[@canvas-js/core](../index.md) / CanvasEvents

# Interface: CanvasEvents

## Extends

- `GossipLogEvents`\<`Action` \| `Session`, `unknown`\>

## Properties

### close

> **close**: `Event`

#### Source

[packages/core/src/Canvas.ts:72](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L72)

***

### commit

> **commit**: `CustomEvent`\<`Object`\>

#### Type declaration

##### root

> **root**: `Node`

#### Inherited from

`GossipLogEvents.commit`

#### Source

packages/gossiplog/lib/AbstractGossipLog.d.ts:37

***

### connect

> **connect**: `CustomEvent`\<`Object`\>

#### Type declaration

##### peer

> **peer**: [`PeerId`](../type-aliases/PeerId.md)

#### Source

[packages/core/src/Canvas.ts:73](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L73)

***

### connections:updated

> **connections:updated**: `CustomEvent`\<[`ConnectionsInfo`](../type-aliases/ConnectionsInfo.md)\>

#### Source

[packages/core/src/Canvas.ts:75](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L75)

***

### disconnect

> **disconnect**: `CustomEvent`\<`Object`\>

#### Type declaration

##### peer

> **peer**: [`PeerId`](../type-aliases/PeerId.md)

#### Source

[packages/core/src/Canvas.ts:74](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L74)

***

### error

> **error**: `CustomEvent`\<`Object`\>

#### Type declaration

##### error

> **error**: `Error`

#### Inherited from

`GossipLogEvents.error`

#### Source

packages/gossiplog/lib/AbstractGossipLog.d.ts:45

***

### message

> **message**: `CustomEvent`\<`Object`\>

#### Type declaration

##### id

> **id**: `string`

##### message

> **message**: `Message`\<`Action` \| `Session`\>

##### result

> **result**: `unknown`

##### signature

> **signature**: `Signature`

#### Inherited from

`GossipLogEvents.message`

#### Source

packages/gossiplog/lib/AbstractGossipLog.d.ts:31

***

### presence:join

> **presence:join**: `CustomEvent`\<[`PresenceInfo`](../type-aliases/PresenceInfo.md) & `Object`\>

#### Source

[packages/core/src/Canvas.ts:76](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L76)

***

### presence:leave

> **presence:leave**: `CustomEvent`\<[`PresenceInfo`](../type-aliases/PresenceInfo.md)\>

#### Source

[packages/core/src/Canvas.ts:79](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L79)

***

### sync

> **sync**: `CustomEvent`\<`Object`\>

#### Type declaration

##### duration

> **duration**: `number`

##### messageCount

> **messageCount**: `number`

##### peer?

> **`optional`** **peer**: `string`

#### Inherited from

`GossipLogEvents.sync`

#### Source

packages/gossiplog/lib/AbstractGossipLog.d.ts:40
