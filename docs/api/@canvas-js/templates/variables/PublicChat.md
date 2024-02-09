[Documentation](../../../index.md) / [@canvas-js/templates](../index.md) / PublicChat

# Variable: PublicChat

> **`const`** **PublicChat**: `Object`

## Type declaration

### actions

> **actions**: `Object`

### actions.sendMessage

> **sendMessage**: (`db`, `__namedParameters`, `__namedParameters`) => `void`

#### Parameters

• **db**: [`ModelAPI`](../../core/type-aliases/ModelAPI.md)

• **\_\_namedParameters**

• **\_\_namedParameters\.message**: `string`

• **\_\_namedParameters**: [`ActionContext`](../../core/type-aliases/ActionContext.md)

#### Returns

`void`

### models

> **models**: `Object`

### models.messages

> **messages**: `Object`

### models.messages.$indexes

> **$indexes**: `string`[][]

### models.messages.address

> **address**: `"string"` = `"string"`

### models.messages.id

> **id**: `"primary"` = `"primary"`

### models.messages.message

> **message**: `"string"` = `"string"`

### models.messages.timestamp

> **timestamp**: `"integer"` = `"integer"`

## Source

[index.ts:5](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/templates/src/index.ts#L5)
