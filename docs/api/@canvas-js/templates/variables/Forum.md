[Documentation](../../../index.md) / [@canvas-js/templates](../index.md) / Forum

# Variable: Forum

> **`const`** **Forum**: `Object`

## Type declaration

### actions

> **actions**: `Object`

### actions.createCategory()

#### Parameters

• **db**: [`ModelAPI`](../../core/type-aliases/ModelAPI.md)

• **\_\_namedParameters**: `any`

• **\_\_namedParameters**: [`ActionContext`](../../core/type-aliases/ActionContext.md)

#### Returns

`Promise`\<`void`\>

### actions.createReply()

#### Parameters

• **db**: [`ModelAPI`](../../core/type-aliases/ModelAPI.md)

• **\_\_namedParameters**: `any`

• **\_\_namedParameters**: [`ActionContext`](../../core/type-aliases/ActionContext.md)

#### Returns

`Promise`\<`void`\>

### actions.createTag()

#### Parameters

• **db**: [`ModelAPI`](../../core/type-aliases/ModelAPI.md)

• **\_\_namedParameters**: `any`

• **\_\_namedParameters**: [`ActionContext`](../../core/type-aliases/ActionContext.md)

#### Returns

`Promise`\<`void`\>

### actions.createThread()

#### Parameters

• **db**: [`ModelAPI`](../../core/type-aliases/ModelAPI.md)

• **\_\_namedParameters**: `any`

• **\_\_namedParameters**: [`ActionContext`](../../core/type-aliases/ActionContext.md)

#### Returns

`Promise`\<`void`\>

### actions.deleteCategory()

#### Parameters

• **db**: [`ModelAPI`](../../core/type-aliases/ModelAPI.md)

• **\_\_namedParameters**: `any`

• **\_\_namedParameters**: [`ActionContext`](../../core/type-aliases/ActionContext.md)

#### Returns

`Promise`\<`void`\>

### actions.deleteMessage()

#### Parameters

• **db**: [`ModelAPI`](../../core/type-aliases/ModelAPI.md)

• **\_\_namedParameters**: `any`

• **\_\_namedParameters**: [`ActionContext`](../../core/type-aliases/ActionContext.md)

#### Returns

`Promise`\<`void`\>

### actions.deleteReply()

#### Parameters

• **db**: [`ModelAPI`](../../core/type-aliases/ModelAPI.md)

• **\_\_namedParameters**: `any`

• **\_\_namedParameters**: [`ActionContext`](../../core/type-aliases/ActionContext.md)

#### Returns

`Promise`\<`void`\>

### actions.deleteTag()

#### Parameters

• **db**: [`ModelAPI`](../../core/type-aliases/ModelAPI.md)

• **\_\_namedParameters**: `any`

• **\_\_namedParameters**: [`ActionContext`](../../core/type-aliases/ActionContext.md)

#### Returns

`Promise`\<`void`\>

### models

> **models**: `Object`

### models.categories

> **categories**: `Object`

### models.categories.name

> **name**: `"primary"` = `"primary"`

### models.memberships

> **memberships**: `Object`

### models.memberships.category

> **category**: `"string"` = `"string"`

### models.memberships.id

> **id**: `"primary"` = `"primary"`

### models.memberships.timestamp

> **timestamp**: `"integer"` = `"integer"`

### models.memberships.user

> **user**: `"string"` = `"string"`

### models.replies

> **replies**: `Object`

### models.replies.$indexes

> **$indexes**: `string`[][]

### models.replies.address

> **address**: `"string"` = `"string"`

### models.replies.id

> **id**: `"primary"` = `"primary"`

### models.replies.reply

> **reply**: `"string"` = `"string"`

### models.replies.threadId

> **threadId**: `"@threads"` = `"@threads"`

### models.replies.timestamp

> **timestamp**: `"integer"` = `"integer"`

### models.tags

> **tags**: `Object`

### models.tags.name

> **name**: `"primary"` = `"primary"`

### models.threads

> **threads**: `Object`

### models.threads.$indexes

> **$indexes**: `string`[][]

### models.threads.address

> **address**: `"string"` = `"string"`

### models.threads.category

> **category**: `"string"` = `"string"`

### models.threads.id

> **id**: `"primary"` = `"primary"`

### models.threads.message

> **message**: `"string"` = `"string"`

### models.threads.replies

> **replies**: `"integer"` = `"integer"`

### models.threads.timestamp

> **timestamp**: `"integer"` = `"integer"`

### models.threads.title

> **title**: `"string"` = `"string"`

## Source

[index.ts:70](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/templates/src/index.ts#L70)
