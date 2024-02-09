[@canvas-js/core](../index.md) / Canvas

# Class: Canvas\<T\>

## Extends

- `TypedEventEmitter`\<[`CanvasEvents`](../interfaces/CanvasEvents.md)\>

## Type parameters

• **T** extends [`Contract`](../type-aliases/Contract.md) = [`Contract`](../type-aliases/Contract.md)

## Constructors

### new Canvas(signers, libp2p, messageLog, runtime, offline, disablePing)

> **`private`** **new Canvas**\<`T`\>(`signers`, `libp2p`, `messageLog`, `runtime`, `offline`?, `disablePing`?): [`Canvas`](Canvas.md)\<`T`\>

#### Parameters

• **signers**: `SignerCache`

• **libp2p**: `Libp2p`\<`ServiceMap`\>

• **messageLog**: `AbstractGossipLog`\<`Action` \| `Session`, `any`\>

• **runtime**: `AbstractRuntime`

• **offline?**: `boolean`

• **disablePing?**: `boolean`

#### Returns

[`Canvas`](Canvas.md)\<`T`\>

#### Overrides

`TypedEventEmitter<CanvasEvents>.constructor`

#### Source

[packages/core/src/Canvas.ts:160](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L160)

## Properties

### #open

> **`private`** **#open**: `boolean` = `true`

#### Source

[packages/core/src/Canvas.ts:158](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L158)

***

### #private

> **`private`** **#private**: `any`

#### Inherited from

`TypedEventEmitter.#private`

#### Source

node\_modules/@libp2p/interface/dist/src/event-target.d.ts:28

***

### \_abortController

> **`private`** **`readonly`** **\_abortController**: `AbortController`

#### Source

[packages/core/src/Canvas.ts:155](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L155)

***

### \_connections

> **`private`** **\_connections**: [`Connection`](../interfaces/Connection.md)[] = `[]`

#### Source

[packages/core/src/Canvas.ts:152](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L152)

***

### \_log

> **`private`** **`readonly`** **\_log**: `Logger`

#### Source

[packages/core/src/Canvas.ts:156](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L156)

***

### \_peers

> **`private`** **\_peers**: [`PeerId`](../type-aliases/PeerId.md)[] = `[]`

#### Source

[packages/core/src/Canvas.ts:151](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L151)

***

### \_pingTimer

> **`private`** **\_pingTimer**: `undefined` \| `Timeout`

#### Source

[packages/core/src/Canvas.ts:153](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L153)

***

### actions

> **`readonly`** **actions**: `{ [K in string | number | symbol]: T["actions"][K] extends ActionImplementationFunction<Args, Result> ? ActionAPI<Args, Result> : T["actions"][K] extends ActionImplementationObject<Args, Result> ? ActionAPI<Args, Result> : never }`

#### Source

[packages/core/src/Canvas.ts:139](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L139)

***

### connections

> **`readonly`** **connections**: [`Connections`](../type-aliases/Connections.md) = `{}`

#### Source

[packages/core/src/Canvas.ts:147](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L147)

***

### db

> **`readonly`** **db**: `AbstractModelDB`

#### Source

[packages/core/src/Canvas.ts:138](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L138)

***

### libp2p

> **`readonly`** **libp2p**: `Libp2p`\<`ServiceMap`\>

#### Source

[packages/core/src/Canvas.ts:162](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L162)

***

### messageLog

> **`readonly`** **messageLog**: `AbstractGossipLog`\<`Action` \| `Session`, `any`\>

#### Source

[packages/core/src/Canvas.ts:163](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L163)

***

### runtime

> **`private`** **`readonly`** **runtime**: `AbstractRuntime`

#### Source

[packages/core/src/Canvas.ts:164](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L164)

***

### signers

> **`readonly`** **signers**: `SignerCache`

#### Source

[packages/core/src/Canvas.ts:161](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L161)

***

### status

> **status**: [`AppConnectionStatus`](../type-aliases/AppConnectionStatus.md) = `"disconnected"`

#### Source

[packages/core/src/Canvas.ts:148](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L148)

## Accessors

### peerId

> **`get`** **peerId**(): [`PeerId`](../type-aliases/PeerId.md)

#### Returns

[`PeerId`](../type-aliases/PeerId.md)

#### Source

[packages/core/src/Canvas.ts:346](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L346)

***

### topic

> **`get`** **topic**(): `string`

#### Returns

`string`

#### Source

[packages/core/src/Canvas.ts:350](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L350)

## Methods

### addEventListener()

> **addEventListener**\<`K`\>(`type`, `listener`, `options`?): `void`

#### Type parameters

• **K** extends keyof [`CanvasEvents`](../interfaces/CanvasEvents.md)

#### Parameters

• **type**: `K`

• **listener**: `null` \| `EventHandler`\<[`CanvasEvents`](../interfaces/CanvasEvents.md)\[`K`\]\>

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

Append a new message to the end of the log (ie an action generated locally)
Low-level utility method for internal and debugging use.
The normal way to apply actions is to use the `Canvas.actions[name](...)` functions.

#### Parameters

• **payload**: `Action` \| `Session`

• **options**

• **options\.signer?**: `Signer`\<`Message`\<`Action` \| `Session`\>\>

#### Returns

`Promise`\<`Object`\>

> ##### id
>
> > **id**: `string`
>
> ##### recipients
>
> > **recipients**: `Promise`\<[`PeerId`](../type-aliases/PeerId.md)[]\>
>
> ##### result
>
> > **result**: `any`
>

#### Source

[packages/core/src/Canvas.ts:393](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L393)

***

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Source

[packages/core/src/Canvas.ts:354](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L354)

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

### getApplicationData()

> **getApplicationData**(): [`ApplicationData`](../type-aliases/ApplicationData.md)

#### Returns

[`ApplicationData`](../type-aliases/ApplicationData.md)

#### Source

[packages/core/src/Canvas.ts:367](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L367)

***

### getMessage()

> **getMessage**(`id`): `Promise`\<[`null`, `null`] \| [`Signature`, `Message`\<`Action` \| `Session`\>]\>

#### Parameters

• **id**: `string`

#### Returns

`Promise`\<[`null`, `null`] \| [`Signature`, `Message`\<`Action` \| `Session`\>]\>

#### Source

[packages/core/src/Canvas.ts:400](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L400)

***

### getMessages()

> **getMessages**(`lowerBound`, `upperBound`, `options`): `AsyncIterable`\<[`string`, `Signature`, `Message`\<`Action` \| `Session`\>]\>

#### Parameters

• **lowerBound**: `null` \| `Object`= `null`

• **upperBound**: `null` \| `Object`= `null`

• **options**= `{}`

• **options\.reverse?**: `boolean`

#### Returns

`AsyncIterable`\<[`string`, `Signature`, `Message`\<`Action` \| `Session`\>]\>

#### Source

[packages/core/src/Canvas.ts:406](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L406)

***

### insert()

> **insert**(`signature`, `message`): `Promise`\<`Object`\>

Insert an existing signed message into the log (ie received via PubSub)
Low-level utility method for internal and debugging use.
The normal way to apply actions is to use the `Canvas.actions[name](...)` functions.

#### Parameters

• **signature**: `Signature`

• **message**: `Message`\<`Action` \| `Session`\>

#### Returns

`Promise`\<`Object`\>

> ##### id
>
> > **id**: `string`
>

#### Source

[packages/core/src/Canvas.ts:382](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L382)

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

### removeEventListener()

> **removeEventListener**\<`K`\>(`type`, `listener`?, `options`?): `void`

#### Type parameters

• **K** extends keyof [`CanvasEvents`](../interfaces/CanvasEvents.md)

#### Parameters

• **type**: `K`

• **listener?**: `null` \| `EventHandler`\<[`CanvasEvents`](../interfaces/CanvasEvents.md)\[`K`\]\>

• **options?**: `boolean` \| `EventListenerOptions`

#### Returns

`void`

#### Inherited from

`TypedEventEmitter.removeEventListener`

#### Source

node\_modules/@libp2p/interface/dist/src/event-target.d.ts:31

***

### safeDispatchEvent()

> **safeDispatchEvent**\<`Detail`\>(`type`, `detail`?): `boolean`

#### Type parameters

• **Detail**

#### Parameters

• **type**: keyof [`CanvasEvents`](../interfaces/CanvasEvents.md)

• **detail?**: `CustomEventInit`\<`Detail`\>

#### Returns

`boolean`

#### Inherited from

`TypedEventEmitter.safeDispatchEvent`

#### Source

node\_modules/@libp2p/interface/dist/src/event-target.d.ts:33

***

### updateSigners()

> **updateSigners**(`signers`): `void`

#### Parameters

• **signers**: `SessionSigner`\<`any`\>[]

#### Returns

`void`

#### Source

[packages/core/src/Canvas.ts:331](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L331)

***

### updateStatus()

> **`private`** **updateStatus**(): `void`

#### Returns

`void`

#### Source

[packages/core/src/Canvas.ts:335](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L335)

***

### initialize()

> **`static`** **initialize**\<`T`\>(`config`): `Promise`\<[`Canvas`](Canvas.md)\<`T`\>\>

#### Type parameters

• **T** extends [`Contract`](../type-aliases/Contract.md)

#### Parameters

• **config**: [`CanvasConfig`](../interfaces/CanvasConfig.md)\<`T`\>

#### Returns

`Promise`\<[`Canvas`](Canvas.md)\<`T`\>\>

#### Source

[packages/core/src/Canvas.ts:103](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L103)
