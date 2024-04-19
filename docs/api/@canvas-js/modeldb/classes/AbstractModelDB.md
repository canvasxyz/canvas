[Documentation](../../../index.md) / [@canvas-js/modeldb](../index.md) / AbstractModelDB

# Class: `abstract` AbstractModelDB

## Constructors

### new AbstractModelDB(config, options)

> **`protected`** **new AbstractModelDB**(`config`, `options`): [`AbstractModelDB`](AbstractModelDB.md)

#### Parameters

• **config**: [`Config`](../type-aliases/Config.md)

• **options**= `{}`

• **options\.indexHistory?**: `Record`\<`string`, `boolean`\>

#### Returns

[`AbstractModelDB`](AbstractModelDB.md)

#### Source

[AbstractModelDB.ts:21](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/modeldb/src/AbstractModelDB.ts#L21)

## Properties

### #subscriptionId

> **`private`** **#subscriptionId**: `number` = `0`

#### Source

[AbstractModelDB.ts:19](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/modeldb/src/AbstractModelDB.ts#L19)

***

### config

> **`readonly`** **config**: [`Config`](../type-aliases/Config.md)

#### Source

[AbstractModelDB.ts:21](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/modeldb/src/AbstractModelDB.ts#L21)

***

### log

> **`protected`** **`readonly`** **log**: `Logger`

#### Source

[AbstractModelDB.ts:17](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/modeldb/src/AbstractModelDB.ts#L17)

***

### models

> **`readonly`** **models**: `Record`\<`string`, [`Model`](../type-aliases/Model.md)\>

#### Source

[AbstractModelDB.ts:15](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/modeldb/src/AbstractModelDB.ts#L15)

***

### subscriptions

> **`protected`** **`readonly`** **subscriptions**: `Map`\<`number`, `Subscription`\>

#### Source

[AbstractModelDB.ts:18](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/modeldb/src/AbstractModelDB.ts#L18)

## Methods

### apply()

> **`abstract`** **apply**(`effects`): `Promise`\<`void`\>

#### Parameters

• **effects**: [`Effect`](../type-aliases/Effect.md)[]

#### Returns

`Promise`\<`void`\>

#### Source

[AbstractModelDB.ts:40](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/modeldb/src/AbstractModelDB.ts#L40)

***

### close()

> **`abstract`** **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Source

[AbstractModelDB.ts:28](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/modeldb/src/AbstractModelDB.ts#L28)

***

### count()

> **`abstract`** **count**(`modelName`): `Promise`\<`number`\>

#### Parameters

• **modelName**: `string`

#### Returns

`Promise`\<`number`\>

#### Source

[AbstractModelDB.ts:36](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/modeldb/src/AbstractModelDB.ts#L36)

***

### delete()

> **delete**(`modelName`, `key`): `Promise`\<`void`\>

#### Parameters

• **modelName**: `string`

• **key**: `string`

#### Returns

`Promise`\<`void`\>

#### Source

[AbstractModelDB.ts:48](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/modeldb/src/AbstractModelDB.ts#L48)

***

### get()

> **`abstract`** **get**(`modelName`, `key`): `Promise`\<`null` \| [`ModelValue`](../type-aliases/ModelValue.md)\>

#### Parameters

• **modelName**: `string`

• **key**: `string`

#### Returns

`Promise`\<`null` \| [`ModelValue`](../type-aliases/ModelValue.md)\>

#### Source

[AbstractModelDB.ts:30](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/modeldb/src/AbstractModelDB.ts#L30)

***

### getEffectFilter()

> **`private`** **getEffectFilter**(`model`, `query`): (`effect`) => `boolean`

#### Parameters

• **model**: [`Model`](../type-aliases/Model.md)

• **query**: [`QueryParams`](../type-aliases/QueryParams.md)

#### Returns

`Function`

> ##### Parameters
>
> • **effect**: [`Effect`](../type-aliases/Effect.md)
>
> ##### Returns
>
> `boolean`
>

#### Source

[AbstractModelDB.ts:82](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/modeldb/src/AbstractModelDB.ts#L82)

***

### iterate()

> **`abstract`** **iterate**(`modelName`): `AsyncIterable`\<[`ModelValue`](../type-aliases/ModelValue.md)\>

#### Parameters

• **modelName**: `string`

#### Returns

`AsyncIterable`\<[`ModelValue`](../type-aliases/ModelValue.md)\>

#### Source

[AbstractModelDB.ts:32](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/modeldb/src/AbstractModelDB.ts#L32)

***

### query()

> **`abstract`** **query**\<`T`\>(`modelName`, `query`?): `Promise`\<`T`[]\>

#### Type parameters

• **T** extends [`ModelValue`](../type-aliases/ModelValue.md) = [`ModelValue`](../type-aliases/ModelValue.md)

#### Parameters

• **modelName**: `string`

• **query?**: [`QueryParams`](../type-aliases/QueryParams.md)

#### Returns

`Promise`\<`T`[]\>

#### Source

[AbstractModelDB.ts:34](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/modeldb/src/AbstractModelDB.ts#L34)

***

### set()

> **set**(`modelName`, `value`): `Promise`\<`void`\>

#### Parameters

• **modelName**: `string`

• **value**: [`ModelValue`](../type-aliases/ModelValue.md)

#### Returns

`Promise`\<`void`\>

#### Source

[AbstractModelDB.ts:44](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/modeldb/src/AbstractModelDB.ts#L44)

***

### subscribe()

> **subscribe**(`modelName`, `query`, `callback`): `Object`

#### Parameters

• **modelName**: `string`

• **query**: [`QueryParams`](../type-aliases/QueryParams.md)

• **callback**

#### Returns

`Object`

##### id

> **id**: `number`

##### results

> **results**: `Promise`\<[`ModelValue`](../type-aliases/ModelValue.md)[]\>

#### Source

[AbstractModelDB.ts:52](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/modeldb/src/AbstractModelDB.ts#L52)

***

### unsubscribe()

> **unsubscribe**(`id`): `void`

#### Parameters

• **id**: `number`

#### Returns

`void`

#### Source

[AbstractModelDB.ts:78](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/modeldb/src/AbstractModelDB.ts#L78)
