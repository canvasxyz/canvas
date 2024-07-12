[Documentation](../../../packages.md) / [@canvas-js/modeldb](../index.md) / getCompare

# Function: getCompare()

> **getCompare**(`model`, `orderBy`): (`a`, `b`) => `-1` \| `0` \| `1`

## Parameters

• **model**: [`Model`](../type-aliases/Model.md)

• **orderBy**: `Record`\<`string`, `"asc"` \| `"desc"`\>

## Returns

`Function`

### Parameters

• **a**: [`ModelValue`](../type-aliases/ModelValue.md)

• **b**: [`ModelValue`](../type-aliases/ModelValue.md)

### Returns

`-1` \| `0` \| `1`

## Defined in

[query.ts:170](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/modeldb/src/query.ts#L170)
