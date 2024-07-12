[Documentation](../../../packages.md) / [@canvas-js/core](../index.md) / Canvas

# Class: Canvas\<T\>

## Extends

- `TypedEventEmitter`\<[`CanvasEvents`](../interfaces/CanvasEvents.md)\>

## Type Parameters

• **T** *extends* [`Contract`](../type-aliases/Contract.md) = [`Contract`](../type-aliases/Contract.md)

## Properties

### actions

> `readonly` **actions**: \{ \[K in string \| number \| symbol\]: T\["actions"\]\[K\] extends ActionImplementationFunction\<Args\> ? ActionAPI\<Args\> : T\["actions"\]\[K\] extends ActionImplementationObject\<Args\> ? ActionAPI\<Args\> : never \}

#### Defined in

[packages/core/src/Canvas.ts:105](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L105)

***

### db

> `readonly` **db**: [`AbstractModelDB`](../../modeldb/classes/AbstractModelDB.md)

#### Defined in

[packages/core/src/Canvas.ts:104](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L104)

***

### libp2p

> `readonly` **libp2p**: `Libp2p`\<[`ServiceMap`](../../gossiplog/type-aliases/ServiceMap.md)\<[`Action`](../../interfaces/type-aliases/Action.md) \| [`Session`](../../interfaces/type-aliases/Session.md)\>\>

#### Defined in

[packages/core/src/Canvas.ts:119](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L119)

***

### messageLog

> `readonly` **messageLog**: [`AbstractGossipLog`](../../gossiplog/classes/AbstractGossipLog.md)\<[`Action`](../../interfaces/type-aliases/Action.md) \| [`Session`](../../interfaces/type-aliases/Session.md)\>

#### Defined in

[packages/core/src/Canvas.ts:118](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L118)

***

### signers

> `readonly` **signers**: [`SignerCache`](../../interfaces/classes/SignerCache.md)

#### Defined in

[packages/core/src/Canvas.ts:117](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L117)

## Accessors

### peerId

> `get` **peerId**(): [`PeerId`](../interfaces/PeerId.md)

#### Returns

[`PeerId`](../interfaces/PeerId.md)

#### Defined in

[packages/core/src/Canvas.ts:251](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L251)

***

### topic

> `get` **topic**(): `string`

#### Returns

`string`

#### Defined in

[packages/core/src/Canvas.ts:255](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L255)

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

• **K** *extends* keyof [`CanvasEvents`](../interfaces/CanvasEvents.md)

#### Parameters

• **type**: `K`

• **listener**: `null` \| `EventHandler`\<[`CanvasEvents`](../interfaces/CanvasEvents.md)\[`K`\]\>

• **options?**: `boolean` \| `AddEventListenerOptions`

#### Returns

`void`

#### Inherited from

`TypedEventEmitter.addEventListener`

#### Defined in

node\_modules/@libp2p/interface/dist/src/event-target.d.ts:31

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

### getApplicationData()

> **getApplicationData**(): [`ApplicationData`](../type-aliases/ApplicationData.md)

#### Returns

[`ApplicationData`](../type-aliases/ApplicationData.md)

#### Defined in

[packages/core/src/Canvas.ts:268](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L268)

***

### getMessage()

> **getMessage**(`id`): `Promise`\<[`null`, `null`] \| [[`Signature`](../../interfaces/type-aliases/Signature.md), [`Message`](../../gossiplog/type-aliases/Message.md)\<[`Action`](../../interfaces/type-aliases/Action.md) \| [`Session`](../../interfaces/type-aliases/Session.md)\>]\>

#### Parameters

• **id**: `string`

#### Returns

`Promise`\<[`null`, `null`] \| [[`Signature`](../../interfaces/type-aliases/Signature.md), [`Message`](../../gossiplog/type-aliases/Message.md)\<[`Action`](../../interfaces/type-aliases/Action.md) \| [`Session`](../../interfaces/type-aliases/Session.md)\>]\>

#### Defined in

[packages/core/src/Canvas.ts:292](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L292)

***

### getMessages()

> **getMessages**(`lowerBound`, `upperBound`, `options`): `AsyncIterable`\<[`string`, [`Signature`](../../interfaces/type-aliases/Signature.md), [`Message`](../../gossiplog/type-aliases/Message.md)\<[`Action`](../../interfaces/type-aliases/Action.md) \| [`Session`](../../interfaces/type-aliases/Session.md)\>]\>

#### Parameters

• **lowerBound**: `null` \| `object` = `null`

• **upperBound**: `null` \| `object` = `null`

• **options** = `{}`

• **options.reverse?**: `boolean`

#### Returns

`AsyncIterable`\<[`string`, [`Signature`](../../interfaces/type-aliases/Signature.md), [`Message`](../../gossiplog/type-aliases/Message.md)\<[`Action`](../../interfaces/type-aliases/Action.md) \| [`Session`](../../interfaces/type-aliases/Session.md)\>]\>

#### Defined in

[packages/core/src/Canvas.ts:298](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L298)

***

### getSession()

> **getSession**(`query`): `Promise`\<`null` \| `string`\>

Get an existing session

#### Parameters

• **query**

• **query.address**: `string`

• **query.publicKey**: `string`

• **query.timestamp?**: `number`

#### Returns

`Promise`\<`null` \| `string`\>

#### Defined in

[packages/core/src/Canvas.ts:322](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L322)

***

### getSessions()

> **getSessions**(`query`): `Promise`\<`object`[]\>

Get existing sessions

#### Parameters

• **query**

• **query.did**: `string`

• **query.minExpiration?**: `number`

• **query.publicKey**: `string`

#### Returns

`Promise`\<`object`[]\>

#### Defined in

[packages/core/src/Canvas.ts:215](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L215)

***

### insert()

> **insert**(`signature`, `message`): `Promise`\<`object`\>

Insert an existing signed message into the log (ie received via PubSub)
Low-level utility method for internal and debugging use.
The normal way to apply actions is to use the `Canvas.actions[name](...)` functions.

#### Parameters

• **signature**: [`Signature`](../../interfaces/type-aliases/Signature.md)

• **message**: [`Message`](../../gossiplog/type-aliases/Message.md)\<[`Action`](../../interfaces/type-aliases/Action.md) \| [`Session`](../../interfaces/type-aliases/Session.md)\>

#### Returns

`Promise`\<`object`\>

##### id

> **id**: `string`

##### recipients

> **recipients**: `Promise`\<[`PeerId`](../interfaces/PeerId.md)[]\>

#### Defined in

[packages/core/src/Canvas.ts:283](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L283)

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

• **K** *extends* keyof [`CanvasEvents`](../interfaces/CanvasEvents.md)

#### Parameters

• **type**: `K`

• **listener?**: `null` \| `EventHandler`\<[`CanvasEvents`](../interfaces/CanvasEvents.md)\[`K`\]\>

• **options?**: `boolean` \| `EventListenerOptions`

#### Returns

`void`

#### Inherited from

`TypedEventEmitter.removeEventListener`

#### Defined in

node\_modules/@libp2p/interface/dist/src/event-target.d.ts:32

***

### safeDispatchEvent()

> **safeDispatchEvent**\<`Detail`\>(`type`, `detail`?): `boolean`

#### Type Parameters

• **Detail**

#### Parameters

• **type**: keyof [`CanvasEvents`](../interfaces/CanvasEvents.md)

• **detail?**: `CustomEventInit`\<`Detail`\>

#### Returns

`boolean`

#### Inherited from

`TypedEventEmitter.safeDispatchEvent`

#### Defined in

node\_modules/@libp2p/interface/dist/src/event-target.d.ts:34

***

### stop()

> **stop**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Defined in

[packages/core/src/Canvas.ts:259](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L259)

***

### updateSigners()

> **updateSigners**(`signers`): `void`

#### Parameters

• **signers**: [`SessionSigner`](../../interfaces/interfaces/SessionSigner.md)\<`any`\>[]

#### Returns

`void`

#### Defined in

[packages/core/src/Canvas.ts:247](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L247)

***

### initialize()

> `static` **initialize**\<`T`\>(`config`): `Promise`\<[`Canvas`](Canvas.md)\<`T`\>\>

#### Type Parameters

• **T** *extends* [`Contract`](../type-aliases/Contract.md)

#### Parameters

• **config**: [`CanvasConfig`](../interfaces/CanvasConfig.md)\<`T`\>

#### Returns

`Promise`\<[`Canvas`](Canvas.md)\<`T`\>\>

#### Defined in

[packages/core/src/Canvas.ts:65](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L65)
