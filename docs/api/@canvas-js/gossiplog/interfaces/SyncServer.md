[Documentation](../../../packages.md) / [@canvas-js/gossiplog](../index.md) / SyncServer

# Interface: SyncServer

## Extends

- `SyncSource`

## Methods

### getChildren()

> **getChildren**(`level`, `key`): `Awaitable`\<`Node`[]\>

#### Parameters

• **level**: `number`

• **key**: `Key`

#### Returns

`Awaitable`\<`Node`[]\>

#### Inherited from

`SyncSource.getChildren`

#### Defined in

packages/gossiplog/node\_modules/@canvas-js/okra/lib/interface.d.ts:31

***

### getNode()

> **getNode**(`level`, `key`): `Awaitable`\<`null` \| `Node`\>

#### Parameters

• **level**: `number`

• **key**: `Key`

#### Returns

`Awaitable`\<`null` \| `Node`\>

#### Inherited from

`SyncSource.getNode`

#### Defined in

packages/gossiplog/node\_modules/@canvas-js/okra/lib/interface.d.ts:30

***

### getRoot()

> **getRoot**(): `Awaitable`\<`Node`\>

#### Returns

`Awaitable`\<`Node`\>

#### Inherited from

`SyncSource.getRoot`

#### Defined in

packages/gossiplog/node\_modules/@canvas-js/okra/lib/interface.d.ts:29

***

### getValues()

> **getValues**(`keys`): `Awaitable`\<`Uint8Array`[]\>

#### Parameters

• **keys**: `Uint8Array`[]

#### Returns

`Awaitable`\<`Uint8Array`[]\>

#### Defined in

[packages/gossiplog/src/interface.ts:12](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/interface.ts#L12)
