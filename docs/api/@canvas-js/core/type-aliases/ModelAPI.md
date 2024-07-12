[Documentation](../../../packages.md) / [@canvas-js/core](../index.md) / ModelAPI

# Type Alias: ModelAPI

> **ModelAPI**: `object`

## Type declaration

### delete()

> **delete**: (`model`, `key`) => `Promise`\<`void`\>

#### Parameters

• **model**: `string`

• **key**: `string`

#### Returns

`Promise`\<`void`\>

### get()

> **get**: \<`T`\>(`model`, `key`) => `Promise`\<`T` \| `null`\>

#### Type Parameters

• **T** *extends* [`ModelValue`](../../modeldb/type-aliases/ModelValue.md) = [`ModelValue`](../../modeldb/type-aliases/ModelValue.md)

#### Parameters

• **model**: `string`

• **key**: `string`

#### Returns

`Promise`\<`T` \| `null`\>

### set()

> **set**: (`model`, `value`) => `Promise`\<`void`\>

#### Parameters

• **model**: `string`

• **value**: [`ModelValue`](../../modeldb/type-aliases/ModelValue.md)

#### Returns

`Promise`\<`void`\>

## Defined in

[packages/core/src/types.ts:22](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/types.ts#L22)
