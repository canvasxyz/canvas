[@canvas-js/core](../index.md) / ModelAPI

# Type alias: ModelAPI

> **ModelAPI**: `Object`

## Type declaration

### delete

> **delete**: (`model`, `key`) => `Promise`\<`void`\>

#### Parameters

• **model**: `string`

• **key**: `string`

#### Returns

`Promise`\<`void`\>

### get

> **get**: \<`T`\>(`model`, `key`) => `Promise`\<`T` \| `null`\>

#### Type parameters

• **T** extends `ModelValue` = `ModelValue`

#### Parameters

• **model**: `string`

• **key**: `string`

#### Returns

`Promise`\<`T` \| `null`\>

### set

> **set**: (`model`, `value`) => `Promise`\<`void`\>

#### Parameters

• **model**: `string`

• **value**: `ModelValue`

#### Returns

`Promise`\<`void`\>

## Source

[packages/core/src/types.ts:25](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/types.ts#L25)
