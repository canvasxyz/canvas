[Documentation](../../../packages.md) / [@canvas-js/core](../index.md) / ActionAPI

# Type Alias: ActionAPI()\<Args\>

> **ActionAPI**\<`Args`\>: (`args`, `options`?) => `Promise`\<`object`\>

## Type Parameters

• **Args** = `any`

## Parameters

• **args**: `Args`

• **options?**: [`ActionOptions`](ActionOptions.md)

## Returns

`Promise`\<`object`\>

### id

> **id**: `string`

### message

> **message**: [`Message`](../../gossiplog/type-aliases/Message.md)\<[`Action`](../../interfaces/type-aliases/Action.md)\>

### recipients

> **recipients**: `Promise`\<[`PeerId`](../interfaces/PeerId.md)[]\>

### signature

> **signature**: [`Signature`](../../interfaces/type-aliases/Signature.md)

## Defined in

[packages/core/src/Canvas.ts:39](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L39)
