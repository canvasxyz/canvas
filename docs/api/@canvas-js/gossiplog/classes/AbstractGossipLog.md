[Documentation](../../../index.md) / [@canvas-js/gossiplog](../index.md) / AbstractGossipLog

# Class: `abstract` AbstractGossipLog\<Payload, Result\>

## Extends

- `TypedEventEmitter`\<[`GossipLogEvents`](../type-aliases/GossipLogEvents.md)\<`Payload`, `Result`\>\>

## Type parameters

• **Payload** = `unknown`

• **Result** = `unknown`

## Constructors

### new AbstractGossipLog(init)

> **`protected`** **new AbstractGossipLog**\<`Payload`, `Result`\>(`init`): [`AbstractGossipLog`](AbstractGossipLog.md)\<`Payload`, `Result`\>

#### Parameters

• **init**: [`GossipLogInit`](../interfaces/GossipLogInit.md)\<`Payload`, `Result`\>

#### Returns

[`AbstractGossipLog`](AbstractGossipLog.md)\<`Payload`, `Result`\>

#### Overrides

`TypedEventEmitter<
	GossipLogEvents<Payload, Result>
>.constructor`

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:101](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L101)

## Properties

### #apply

> **`private`** **`readonly`** **#apply**: [`GossipLogConsumer`](../type-aliases/GossipLogConsumer.md)\<`Payload`, `Result`\>

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:99](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L99)

***

### #private

> **`private`** **#private**: `any`

#### Inherited from

`TypedEventEmitter.#private`

#### Source

node\_modules/@libp2p/interface/dist/src/event-target.d.ts:28

***

### #transformer

> **`private`** **`readonly`** **#transformer**: `Object`

#### #transformer.toRepresentation

> **toRepresentation**: `TypeTransformerFunction`

#### #transformer.toTyped

> **toTyped**: `TypeTransformerFunction`

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:98](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L98)

***

### indexAncestors

> **`readonly`** **indexAncestors**: `boolean`

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:92](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L92)

***

### log

> **`protected`** **`readonly`** **log**: `Logger`

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:95](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L95)

***

### mempool

> **`protected`** **`readonly`** **mempool**: `Mempool`\<`Object`\>

#### Type declaration

##### message

> **message**: [`Message`](../type-aliases/Message.md)\<`Payload`\>

##### signature

> **signature**: [`Signature`](../../interfaces/type-aliases/Signature.md)

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:96](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L96)

***

### signer

> **`readonly`** **signer**: [`Signer`](../../interfaces/interfaces/Signer.md)\<[`Message`](../type-aliases/Message.md)\<`Payload`\>\>

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:93](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L93)

***

### topic

> **`readonly`** **topic**: `string`

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:91](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L91)

## Methods

### #getAncestors()

> **`private`** **#getAncestors**(`txn`, `key`, `atOrBefore`, `results`, `visited`): `Promise`\<`void`\>

#### Parameters

• **txn**: [`ReadOnlyTransaction`](../interfaces/ReadOnlyTransaction.md)

• **key**: `Uint8Array`

• **atOrBefore**: `number`

• **results**: `Set`\<`string`\>

• **visited**: `Set`\<`string`\>= `undefined`

#### Returns

`Promise`\<`void`\>

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:383](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L383)

***

### #insert()

> **`private`** **#insert**(`txn`, `id`, `signature`, `message`, `__namedParameters`): `Promise`\<`Result`\>

#### Parameters

• **txn**: [`ReadWriteTransaction`](../interfaces/ReadWriteTransaction.md)

• **id**: `string`

• **signature**: [`Signature`](../../interfaces/type-aliases/Signature.md)

• **message**: [`Message`](../type-aliases/Message.md)\<`Payload`\>

• **\_\_namedParameters**: `Entry`= `undefined`

#### Returns

`Promise`\<`Result`\>

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:418](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L418)

***

### addEventListener()

> **addEventListener**\<`K`\>(`type`, `listener`, `options`?): `void`

#### Type parameters

• **K** extends keyof [`GossipLogEvents`](../type-aliases/GossipLogEvents.md)\<`Payload`, `Result`\>

#### Parameters

• **type**: `K`

• **listener**: `null` \| `EventHandler`\<[`GossipLogEvents`](../type-aliases/GossipLogEvents.md)\<`Payload`, `Result`\>\[`K`\]\>

• **options?**: `boolean` \| `AddEventListenerOptions`

#### Returns

`void`

#### Inherited from

`TypedEventEmitter.addEventListener`

#### Source

node\_modules/@libp2p/interface/dist/src/event-target.d.ts:30

***

### append()

> **append**(`payload`, `options`): `Promise`\<`Object`\>

Sign and append a new *unsigned* message to the end of the log.
The currently unmerged heads of the local log are used as parents.

#### Parameters

• **payload**: `Payload`

• **options**= `{}`

• **options\.signer?**: [`Signer`](../../interfaces/interfaces/Signer.md)\<[`Message`](../type-aliases/Message.md)\<`Payload`\>\>

#### Returns

`Promise`\<`Object`\>

> ##### id
>
> > **id**: `string`
>
> ##### message
>
> > **message**: [`Message`](../type-aliases/Message.md)\<`Payload`\>
>
> ##### result
>
> > **result**: `Result`
>
> ##### signature
>
> > **signature**: [`Signature`](../../interfaces/type-aliases/Signature.md)
>

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:245](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L245)

***

### close()

> **`abstract`** **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:73](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L73)

***

### decode()

> **decode**(`value`): [`string`, [`Signature`](../../interfaces/type-aliases/Signature.md), [`Message`](../type-aliases/Message.md)\<`Payload`\>]

#### Parameters

• **value**: `Uint8Array`

#### Returns

[`string`, [`Signature`](../../interfaces/type-aliases/Signature.md), [`Message`](../type-aliases/Message.md)\<`Payload`\>]

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:180](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L180)

***

### dispatchEvent()

> **dispatchEvent**(`event`): `boolean`

#### Parameters

• **event**: `Event`

#### Returns

`boolean`

#### Inherited from

`TypedEventEmitter.dispatchEvent`

#### Source

node\_modules/@libp2p/interface/dist/src/event-target.d.ts:32

***

### encode()

> **encode**(`signature`, `message`): [`Uint8Array`, `Uint8Array`]

#### Parameters

• **signature**: [`Signature`](../../interfaces/type-aliases/Signature.md)

• **message**: [`Message`](../type-aliases/Message.md)\<`Payload`\>

#### Returns

[`Uint8Array`, `Uint8Array`]

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:156](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L156)

***

### entries()

> **`protected`** **`abstract`** **entries**(`lowerBound`?, `upperBound`?, `options`?): `AsyncIterable`\<[`Uint8Array`, `Uint8Array`]\>

#### Parameters

• **lowerBound?**: `null` \| `Bound`\<`Uint8Array`\>

• **upperBound?**: `null` \| `Bound`\<`Uint8Array`\>

• **options?**

• **options\.reverse?**: `boolean`

#### Returns

`AsyncIterable`\<[`Uint8Array`, `Uint8Array`]\>

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:75](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L75)

***

### get()

> **get**(`id`): `Promise`\<[[`Signature`](../../interfaces/type-aliases/Signature.md), [`Message`](../type-aliases/Message.md)\<`Payload`\>] \| [`null`, `null`]\>

#### Parameters

• **id**: `string`

#### Returns

`Promise`\<[[`Signature`](../../interfaces/type-aliases/Signature.md), [`Message`](../type-aliases/Message.md)\<`Payload`\>] \| [`null`, `null`]\>

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:218](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L218)

***

### getAncestors()

> **getAncestors**(`id`, `atOrBefore`): `Promise`\<`string`[]\>

#### Parameters

• **id**: `string`

• **atOrBefore**: `number`

#### Returns

`Promise`\<`string`[]\>

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:323](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L323)

***

### getClock()

> **getClock**(): `Promise`\<[`number`, `string`[]]\>

#### Returns

`Promise`\<[`number`, `string`[]]\>

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:207](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L207)

***

### getHeads()

> **`private`** **getHeads**(`txn`): `Promise`\<`Uint8Array`[]\>

#### Parameters

• **txn**: [`ReadOnlyTransaction`](../interfaces/ReadOnlyTransaction.md)

#### Returns

`Promise`\<`Uint8Array`[]\>

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:229](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L229)

***

### has()

> **has**(`id`): `Promise`\<`boolean`\>

#### Parameters

• **id**: `string`

#### Returns

`Promise`\<`boolean`\>

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:213](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L213)

***

### insert()

> **insert**(`signature`, `message`): `Promise`\<`Object`\>

Insert an existing signed message into the log (ie received via PubSub).
If any of the parents are not present, insert the message into the mempool instead.

#### Parameters

• **signature**: [`Signature`](../../interfaces/type-aliases/Signature.md)

• **message**: [`Message`](../type-aliases/Message.md)\<`Payload`\>

#### Returns

`Promise`\<`Object`\>

> ##### id
>
> > **id**: `string`
>

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:277](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L277)

***

### isAncestor()

> **isAncestor**(`id`, `ancestor`): `Promise`\<`boolean`\>

#### Parameters

• **id**: `string`

• **ancestor**: `string`

#### Returns

`Promise`\<`boolean`\>

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:332](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L332)

***

### iterate()

> **iterate**(`lowerBound`, `upperBound`, `options`): `AsyncIterable`\<[`string`, [`Signature`](../../interfaces/type-aliases/Signature.md), [`Message`](../type-aliases/Message.md)\<`Payload`\>]\>

#### Parameters

• **lowerBound**: `null` \| `Object`= `null`

• **upperBound**: `null` \| `Object`= `null`

• **options**= `{}`

• **options\.reverse?**: `boolean`

#### Returns

`AsyncIterable`\<[`string`, [`Signature`](../../interfaces/type-aliases/Signature.md), [`Message`](../type-aliases/Message.md)\<`Payload`\>]\>

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:135](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L135)

***

### listenerCount()

> **listenerCount**(`type`): `number`

#### Parameters

• **type**: `string`

#### Returns

`number`

#### Inherited from

`TypedEventEmitter.listenerCount`

#### Source

node\_modules/@libp2p/interface/dist/src/event-target.d.ts:29

***

### read()

> **`protected`** **`abstract`** **read**\<`T`\>(`callback`, `options`?): `Promise`\<`T`\>

#### Type parameters

• **T**

#### Parameters

• **callback**

• **options?**

• **options\.targetId?**: `string`

#### Returns

`Promise`\<`T`\>

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:81](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L81)

***

### removeEventListener()

> **removeEventListener**\<`K`\>(`type`, `listener`?, `options`?): `void`

#### Type parameters

• **K** extends keyof [`GossipLogEvents`](../type-aliases/GossipLogEvents.md)\<`Payload`, `Result`\>

#### Parameters

• **type**: `K`

• **listener?**: `null` \| `EventHandler`\<[`GossipLogEvents`](../type-aliases/GossipLogEvents.md)\<`Payload`, `Result`\>\[`K`\]\>

• **options?**: `boolean` \| `EventListenerOptions`

#### Returns

`void`

#### Inherited from

`TypedEventEmitter.removeEventListener`

#### Source

node\_modules/@libp2p/interface/dist/src/event-target.d.ts:31

***

### replay()

> **replay**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:125](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L125)

***

### safeDispatchEvent()

> **safeDispatchEvent**\<`Detail`\>(`type`, `detail`?): `boolean`

#### Type parameters

• **Detail**

#### Parameters

• **type**: keyof [`GossipLogEvents`](../type-aliases/GossipLogEvents.md)\<`Payload`, `Result`\>

• **detail?**: `CustomEventInit`\<`Detail`\>

#### Returns

`boolean`

#### Inherited from

`TypedEventEmitter.safeDispatchEvent`

#### Source

node\_modules/@libp2p/interface/dist/src/event-target.d.ts:33

***

### serve()

> **serve**(`callback`, `options`): `Promise`\<`void`\>

Serve a read-only snapshot of the merkle tree

#### Parameters

• **callback**

• **options**= `{}`

• **options\.targetId?**: `string`

#### Returns

`Promise`\<`void`\>

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:526](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L526)

***

### sync()

> **sync**(`source`, `options`): `Promise`\<`Object`\>

Sync with a remote source, applying and inserting all missing messages into the local log

#### Parameters

• **source**: `Source`

• **options**= `{}`

• **options\.sourceId?**: `string`

• **options\.timeoutController?**: `DelayableController`

#### Returns

`Promise`\<`Object`\>

> ##### messageCount
>
> > **messageCount**: `number`
>
> ##### root
>
> > **root**: `Node`
>

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:480](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L480)

***

### write()

> **`protected`** **`abstract`** **write**\<`T`\>(`callback`, `options`?): `Promise`\<`T`\>

#### Type parameters

• **T**

#### Parameters

• **callback**

• **options?**

• **options\.sourceId?**: `string`

#### Returns

`Promise`\<`T`\>

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:86](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L86)

***

### isAncestor()

> **`static`** **isAncestor**(`txn`, `id`, `ancestor`, `visited`): `Promise`\<`boolean`\>

#### Parameters

• **txn**: [`ReadOnlyTransaction`](../interfaces/ReadOnlyTransaction.md)

• **id**: `string`

• **ancestor**: `string`

• **visited**: `Set`\<`string`\>= `undefined`

#### Returns

`Promise`\<`boolean`\>

#### Source

[packages/gossiplog/src/AbstractGossipLog.ts:337](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/gossiplog/src/AbstractGossipLog.ts#L337)
