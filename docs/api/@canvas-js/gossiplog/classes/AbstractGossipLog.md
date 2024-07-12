[Documentation](../../../packages.md) / [@canvas-js/gossiplog](../index.md) / AbstractGossipLog

# Class: `abstract` AbstractGossipLog\<Payload\>

## Extends

- `TypedEventEmitter`\<[`GossipLogEvents`](../type-aliases/GossipLogEvents.md)\<`Payload`\>\>

## Type Parameters

• **Payload** = `unknown`

## Constructors

### new AbstractGossipLog()

> `protected` **new AbstractGossipLog**\<`Payload`\>(`init`): [`AbstractGossipLog`](AbstractGossipLog.md)\<`Payload`\>

#### Parameters

• **init**: [`GossipLogInit`](../interfaces/GossipLogInit.md)\<`Payload`\>

#### Returns

[`AbstractGossipLog`](AbstractGossipLog.md)\<`Payload`\>

#### Overrides

`TypedEventEmitter<GossipLogEvents<Payload>>.constructor`

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:83](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L83)

## Properties

### db

> `abstract` **db**: [`AbstractModelDB`](../../modeldb/classes/AbstractModelDB.md)

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:72](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L72)

***

### log

> `protected` `readonly` **log**: `Logger`

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:76](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L76)

***

### signer

> `readonly` **signer**: [`Signer`](../../interfaces/interfaces/Signer.md)\<`Payload`\>

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:70](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L70)

***

### topic

> `readonly` **topic**: `string`

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:69](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L69)

***

### tree

> `abstract` **tree**: `Tree`

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:73](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L73)

***

### validatePayload()

> `readonly` **validatePayload**: (`payload`) => `payload is Payload`

#### Parameters

• **payload**: `unknown`

#### Returns

`payload is Payload`

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:78](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L78)

***

### verifySignature()

> `readonly` **verifySignature**: (`signature`, `message`) => [`Awaitable`](../../interfaces/type-aliases/Awaitable.md)\<`void`\>

#### Parameters

• **signature**: [`Signature`](../../interfaces/type-aliases/Signature.md)

• **message**: [`Message`](../type-aliases/Message.md)\<`Payload`\>

#### Returns

[`Awaitable`](../../interfaces/type-aliases/Awaitable.md)\<`void`\>

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:79](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L79)

***

### schema

> `static` **schema**: `object`

#### $ancestors

> **$ancestors**: `object`

#### $ancestors.id

> **$ancestors.id**: `"primary"` = `"primary"`

#### $ancestors.links

> **$ancestors.links**: `"json"` = `"json"`

#### $branch\_merges

> **$branch\_merges**: `object`

#### $branch\_merges.id

> **$branch\_merges.id**: `"primary"` = `"primary"`

#### $branch\_merges.source\_branch

> **$branch\_merges.source\_branch**: `"integer"` = `"integer"`

#### $branch\_merges.source\_clock

> **$branch\_merges.source\_clock**: `"integer"` = `"integer"`

#### $branch\_merges.source\_message\_id

> **$branch\_merges.source\_message\_id**: `"string"` = `"string"`

#### $branch\_merges.target\_branch

> **$branch\_merges.target\_branch**: `"integer"` = `"integer"`

#### $branch\_merges.target\_clock

> **$branch\_merges.target\_clock**: `"integer"` = `"integer"`

#### $branch\_merges.target\_message\_id

> **$branch\_merges.target\_message\_id**: `"string"` = `"string"`

#### $heads

> **$heads**: `object`

#### $heads.id

> **$heads.id**: `"primary"` = `"primary"`

#### $messages

> **$messages**: `object`

#### $messages.$indexes

> **$messages.$indexes**: `string`[]

#### $messages.branch

> **$messages.branch**: `"integer"` = `"integer"`

#### $messages.clock

> **$messages.clock**: `"integer"` = `"integer"`

#### $messages.hash

> **$messages.hash**: `"string"` = `"string"`

#### $messages.id

> **$messages.id**: `"primary"` = `"primary"`

#### $messages.message

> **$messages.message**: `"json"` = `"json"`

#### $messages.signature

> **$messages.signature**: `"json"` = `"json"`

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:54](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L54)

## Methods

### addEventListener()

> **addEventListener**\<`K`\>(`type`, `listener`, `options`?): `void`

Appends an event listener for events whose type attribute value is type. The callback argument sets the callback that will be invoked when the event is dispatched.

The options argument sets listener-specific options. For compatibility this can be a boolean, in which case the method behaves exactly as if the value was specified as options's capture.

When set to true, options's capture prevents callback from being invoked when the event's eventPhase attribute value is BUBBLING_PHASE. When false (or not present), callback will not be invoked when event's eventPhase attribute value is CAPTURING_PHASE. Either way, callback will be invoked if event's eventPhase attribute value is AT_TARGET.

When set to true, options's passive indicates that the callback will not cancel the event by invoking preventDefault(). This is used to enable performance optimizations described in § 2.8 Observing event listeners.

When set to true, options's once indicates that the callback will only be invoked once after which the event listener will be removed.

If an AbortSignal is passed for options's signal, then the event listener will be removed when signal is aborted.

The event listener is appended to target's event listener list and is not appended if it has the same type, callback, and capture.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/addEventListener)

#### Type Parameters

• **K** *extends* keyof [`GossipLogEvents`](../type-aliases/GossipLogEvents.md)\<`Payload`\>

#### Parameters

• **type**: `K`

• **listener**: `null` \| `EventHandler`\<[`GossipLogEvents`](../type-aliases/GossipLogEvents.md)\<`Payload`\>\[`K`\]\>

• **options?**: `boolean` \| `AddEventListenerOptions`

#### Returns

`void`

#### Inherited from

`TypedEventEmitter.addEventListener`

#### Defined in

node\_modules/@libp2p/interface/dist/src/event-target.d.ts:31

***

### append()

> **append**\<`T`\>(`payload`, `options`): `Promise`\<`SignedMessage`\<`T`\>\>

Sign and append a new *unsigned* message to the end of the log.
The concurrent heads of the local log are used as parents.

#### Type Parameters

• **T** = `Payload`

#### Parameters

• **payload**: `T`

• **options** = `{}`

• **options.signer?**: [`Signer`](../../interfaces/interfaces/Signer.md)\<`Payload`\>

#### Returns

`Promise`\<`SignedMessage`\<`T`\>\>

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:190](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L190)

***

### close()

> `abstract` **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:74](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L74)

***

### decode()

> **decode**(`value`): `SignedMessage`\<`Payload`\>

#### Parameters

• **value**: `Uint8Array`

#### Returns

`SignedMessage`\<`Payload`\>

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:129](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L129)

***

### dispatchEvent()

> **dispatchEvent**(`event`): `boolean`

Dispatches a synthetic event event to target and returns true if either event's cancelable attribute value is false or its preventDefault() method was not invoked, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/dispatchEvent)

#### Parameters

• **event**: `Event`

#### Returns

`boolean`

#### Inherited from

`TypedEventEmitter.dispatchEvent`

#### Defined in

node\_modules/@libp2p/interface/dist/src/event-target.d.ts:33

***

### encode()

> **encode**\<`T`\>(`signature`, `message`, `__namedParameters`): `SignedMessage`\<`T`\>

#### Type Parameters

• **T** = `Payload`

#### Parameters

• **signature**: [`Signature`](../../interfaces/type-aliases/Signature.md)

• **message**: [`Message`](../type-aliases/Message.md)\<`T`\>

• **\_\_namedParameters** = `...`

• **\_\_namedParameters.replaceUndefined**: `boolean`

#### Returns

`SignedMessage`\<`T`\>

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:118](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L118)

***

### get()

> **get**(`id`): `Promise`\<[[`Signature`](../../interfaces/type-aliases/Signature.md), [`Message`](../type-aliases/Message.md)\<`Payload`\>] \| [`null`, `null`]\>

#### Parameters

• **id**: `string`

#### Returns

`Promise`\<[[`Signature`](../../interfaces/type-aliases/Signature.md), [`Message`](../type-aliases/Message.md)\<`Payload`\>] \| [`null`, `null`]\>

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:149](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L149)

***

### getClock()

> **getClock**(): `Promise`\<[`number`, `string`[]]\>

#### Returns

`Promise`\<[`number`, `string`[]]\>

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:136](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L136)

***

### getMessages()

> **getMessages**(`range`): `Promise`\<`object`[]\>

#### Parameters

• **range** = `{}`

• **range.gt?**: `string`

• **range.gte?**: `string`

• **range.limit?**: `number`

• **range.lt?**: `string`

• **range.lte?**: `string`

• **range.reverse?**: `boolean`

#### Returns

`Promise`\<`object`[]\>

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:158](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L158)

***

### getMissingParents()

> **getMissingParents**(`txn`, `parents`): `Set`\<`string`\>

#### Parameters

• **txn**: `ReadWriteTransaction`

• **parents**: `string`[]

#### Returns

`Set`\<`string`\>

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:225](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L225)

***

### has()

> **has**(`id`): `Promise`\<`boolean`\>

#### Parameters

• **id**: `string`

#### Returns

`Promise`\<`boolean`\>

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:143](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L143)

***

### insert()

> **insert**(`signedMessage`): `Promise`\<`object`\>

Insert an existing signed message into the log (ie received via HTTP API).
If any of the parents are not present, throw an error.

#### Parameters

• **signedMessage**: `SignedMessage`\<`Payload`\>

#### Returns

`Promise`\<`object`\>

##### id

> **id**: `string`

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:246](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L246)

***

### isAncestor()

> **isAncestor**(`id`, `ancestor`, `visited`): `Promise`\<`boolean`\>

#### Parameters

• **id**: `string`

• **ancestor**: `string`

• **visited**: `Set`\<`string`\> = `...`

#### Returns

`Promise`\<`boolean`\>

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:386](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L386)

***

### iterate()

> **iterate**(`range`): `AsyncIterable`\<`object`\>

#### Parameters

• **range** = `{}`

• **range.gt?**: `string`

• **range.gte?**: `string`

• **range.limit?**: `number`

• **range.lt?**: `string`

• **range.lte?**: `string`

• **range.reverse?**: `boolean`

#### Returns

`AsyncIterable`\<`object`\>

##### id

> **id**: `string`

##### message

> **message**: [`Message`](../type-aliases/Message.md)\<`Payload`\>

##### signature

> **signature**: [`Signature`](../../interfaces/type-aliases/Signature.md)

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:170](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L170)

***

### listenerCount()

> **listenerCount**(`type`): `number`

#### Parameters

• **type**: `string`

#### Returns

`number`

#### Inherited from

`TypedEventEmitter.listenerCount`

#### Defined in

node\_modules/@libp2p/interface/dist/src/event-target.d.ts:30

***

### removeEventListener()

> **removeEventListener**\<`K`\>(`type`, `listener`?, `options`?): `void`

Removes the event listener in target's event listener list with the same type, callback, and options.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/removeEventListener)

#### Type Parameters

• **K** *extends* keyof [`GossipLogEvents`](../type-aliases/GossipLogEvents.md)\<`Payload`\>

#### Parameters

• **type**: `K`

• **listener?**: `null` \| `EventHandler`\<[`GossipLogEvents`](../type-aliases/GossipLogEvents.md)\<`Payload`\>\[`K`\]\>

• **options?**: `boolean` \| `EventListenerOptions`

#### Returns

`void`

#### Inherited from

`TypedEventEmitter.removeEventListener`

#### Defined in

node\_modules/@libp2p/interface/dist/src/event-target.d.ts:32

***

### replay()

> **replay**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:97](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L97)

***

### safeDispatchEvent()

> **safeDispatchEvent**\<`Detail`\>(`type`, `detail`?): `boolean`

#### Type Parameters

• **Detail**

#### Parameters

• **type**: keyof [`GossipLogEvents`](../type-aliases/GossipLogEvents.md)\<`Payload`\>

• **detail?**: `CustomEventInit`\<`Detail`\>

#### Returns

`boolean`

#### Inherited from

`TypedEventEmitter.safeDispatchEvent`

#### Defined in

node\_modules/@libp2p/interface/dist/src/event-target.d.ts:34

***

### serve()

> **serve**\<`T`\>(`callback`): `Promise`\<`T`\>

#### Type Parameters

• **T**

#### Parameters

• **callback**

#### Returns

`Promise`\<`T`\>

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:419](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L419)

***

### sync()

> **sync**(`server`, `options`): `Promise`\<`object`\>

Sync with a remote source, applying and inserting all missing messages into the local log

#### Parameters

• **server**: [`SyncServer`](../interfaces/SyncServer.md)

• **options** = `{}`

• **options.sourceId?**: `string`

#### Returns

`Promise`\<`object`\>

##### messageCount

> **messageCount**: `number`

#### Defined in

[packages/gossiplog/src/AbstractGossipLog.ts:393](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/AbstractGossipLog.ts#L393)
