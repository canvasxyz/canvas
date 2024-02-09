[Documentation](../../../index.md) / [@canvas-js/templates](../index.md) / ChannelChat

# Variable: ChannelChat

> **`const`** **ChannelChat**: `Object`

## Type declaration

### actions

> **actions**: `Object`

### actions.deleteMessage()

#### Parameters

• **db**: [`ModelAPI`](../../core/type-aliases/ModelAPI.md)

• **\_\_namedParameters**: `any`

• **\_\_namedParameters**: [`ActionContext`](../../core/type-aliases/ActionContext.md)

#### Returns

`Promise`\<`void`\>

### actions.joinChannel()

#### Parameters

• **db**: [`ModelAPI`](../../core/type-aliases/ModelAPI.md)

• **\_\_namedParameters**: `any`

• **\_\_namedParameters**: [`ActionContext`](../../core/type-aliases/ActionContext.md)

#### Returns

`Promise`\<`void`\>

### actions.leaveChannel()

#### Parameters

• **db**: [`ModelAPI`](../../core/type-aliases/ModelAPI.md)

• **\_\_namedParameters**: `any`

• **\_\_namedParameters**: [`ActionContext`](../../core/type-aliases/ActionContext.md)

#### Returns

`Promise`\<`void`\>

### actions.sendMessage()

#### Parameters

• **db**: [`ModelAPI`](../../core/type-aliases/ModelAPI.md)

• **\_\_namedParameters**: `any`

• **\_\_namedParameters**: [`ActionContext`](../../core/type-aliases/ActionContext.md)

#### Returns

`Promise`\<`void`\>

### models

> **models**: `Object`

### models.channels

> **channels**: `Object`

### models.channels.name

> **name**: `"primary"` = `"primary"`

### models.memberships

> **memberships**: `Object`

### models.memberships.channel

> **channel**: `"string"` = `"string"`

### models.memberships.id

> **id**: `"primary"` = `"primary"`

### models.memberships.timestamp

> **timestamp**: `"integer"` = `"integer"`

### models.memberships.user

> **user**: `"string"` = `"string"`

### models.messages

> **messages**: `Object`

### models.messages.$indexes

> **$indexes**: `string`[][]

### models.messages.address

> **address**: `"string"` = `"string"`

### models.messages.channel

> **channel**: `"string"` = `"string"`

### models.messages.id

> **id**: `"primary"` = `"primary"`

### models.messages.message

> **message**: `"string"` = `"string"`

### models.messages.timestamp

> **timestamp**: `"integer"` = `"integer"`

## Source

[index.ts:23](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/templates/src/index.ts#L23)
