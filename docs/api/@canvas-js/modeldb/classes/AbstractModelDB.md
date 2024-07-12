[Documentation](../../../packages.md) / [@canvas-js/modeldb](../index.md) / AbstractModelDB

# Class: `abstract` AbstractModelDB

## Constructors

### new AbstractModelDB()

> `protected` **new AbstractModelDB**(`config`): [`AbstractModelDB`](AbstractModelDB.md)

#### Parameters

• **config**: [`Config`](../type-aliases/Config.md)

#### Returns

[`AbstractModelDB`](AbstractModelDB.md)

#### Defined in

[AbstractModelDB.ts:23](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/modeldb/src/AbstractModelDB.ts#L23)

## Properties

### config

> `readonly` **config**: [`Config`](../type-aliases/Config.md)

#### Defined in

[AbstractModelDB.ts:23](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/modeldb/src/AbstractModelDB.ts#L23)

***

### log

> `protected` `readonly` **log**: `Logger`

#### Defined in

[AbstractModelDB.ts:19](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/modeldb/src/AbstractModelDB.ts#L19)

***

### models

> `readonly` **models**: `Record`\<`string`, [`Model`](../type-aliases/Model.md)\>

#### Defined in

[AbstractModelDB.ts:17](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/modeldb/src/AbstractModelDB.ts#L17)

***

### subscriptions

> `protected` `readonly` **subscriptions**: `Map`\<`number`, `Subscription`\>

#### Defined in

[AbstractModelDB.ts:20](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/modeldb/src/AbstractModelDB.ts#L20)

## Methods

### apply()

> `abstract` **apply**(`effects`): `Promise`\<`void`\>

#### Parameters

• **effects**: [`Effect`](../type-aliases/Effect.md)[]

#### Returns

`Promise`\<`void`\>

#### Defined in

[AbstractModelDB.ts:42](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/modeldb/src/AbstractModelDB.ts#L42)

***

### close()

> `abstract` **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Defined in

[AbstractModelDB.ts:30](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/modeldb/src/AbstractModelDB.ts#L30)

***

### count()

> `abstract` **count**(`modelName`): `Promise`\<`number`\>

#### Parameters

• **modelName**: `string`

#### Returns

`Promise`\<`number`\>

#### Defined in

[AbstractModelDB.ts:38](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/modeldb/src/AbstractModelDB.ts#L38)

***

### delete()

> **delete**(`modelName`, `key`): `Promise`\<`void`\>

#### Parameters

• **modelName**: `string`

• **key**: `string`

#### Returns

`Promise`\<`void`\>

#### Defined in

[AbstractModelDB.ts:50](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/modeldb/src/AbstractModelDB.ts#L50)

***

### get()

> `abstract` **get**\<`T`\>(`modelName`, `key`): `Promise`\<`null` \| `T`\>

#### Type Parameters

• **T** *extends* [`ModelValue`](../type-aliases/ModelValue.md)\<`any`\> = [`ModelValue`](../type-aliases/ModelValue.md)\<`any`\>

#### Parameters

• **modelName**: `string`

• **key**: `string`

#### Returns

`Promise`\<`null` \| `T`\>

#### Defined in

[AbstractModelDB.ts:32](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/modeldb/src/AbstractModelDB.ts#L32)

***

### iterate()

> `abstract` **iterate**(`modelName`): `AsyncIterable`\<[`ModelValue`](../type-aliases/ModelValue.md)\>

#### Parameters

• **modelName**: `string`

#### Returns

`AsyncIterable`\<[`ModelValue`](../type-aliases/ModelValue.md)\>

#### Defined in

[AbstractModelDB.ts:34](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/modeldb/src/AbstractModelDB.ts#L34)

***

### query()

> `abstract` **query**\<`T`\>(`modelName`, `query`?): `Promise`\<`T`[]\>

#### Type Parameters

• **T** *extends* [`ModelValue`](../type-aliases/ModelValue.md)\<`any`\> = [`ModelValue`](../type-aliases/ModelValue.md)\<`any`\>

#### Parameters

• **modelName**: `string`

• **query?**: [`QueryParams`](../type-aliases/QueryParams.md)

#### Returns

`Promise`\<`T`[]\>

#### Defined in

[AbstractModelDB.ts:36](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/modeldb/src/AbstractModelDB.ts#L36)

***

### set()

> **set**\<`T`\>(`modelName`, `value`): `Promise`\<`void`\>

#### Type Parameters

• **T** *extends* [`ModelValue`](../type-aliases/ModelValue.md)\<`any`\> = [`ModelValue`](../type-aliases/ModelValue.md)\<`any`\>

#### Parameters

• **modelName**: `string`

• **value**: `T`

#### Returns

`Promise`\<`void`\>

#### Defined in

[AbstractModelDB.ts:46](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/modeldb/src/AbstractModelDB.ts#L46)

***

### subscribe()

> **subscribe**(`modelName`, `query`, `callback`): `object`

#### Parameters

• **modelName**: `string`

• **query**: [`QueryParams`](../type-aliases/QueryParams.md)

• **callback**

#### Returns

`object`

##### id

> **id**: `number`

##### results

> **results**: `Promise`\<[`ModelValue`](../type-aliases/ModelValue.md)[]\>

#### Defined in

[AbstractModelDB.ts:54](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/modeldb/src/AbstractModelDB.ts#L54)

***

### unsubscribe()

> **unsubscribe**(`id`): `void`

#### Parameters

• **id**: `number`

#### Returns

`void`

#### Defined in

[AbstractModelDB.ts:80](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/modeldb/src/AbstractModelDB.ts#L80)
