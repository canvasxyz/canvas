[Documentation](../../../packages.md) / [@canvas-js/core](../index.md) / CanvasConfig

# Interface: CanvasConfig\<T\>

## Extends

- [`NetworkConfig`](../../gossiplog/interfaces/NetworkConfig.md)

## Type Parameters

• **T** *extends* [`Contract`](../type-aliases/Contract.md) = [`Contract`](../type-aliases/Contract.md)

## Properties

### announce?

> `optional` **announce**: `string`[]

array of public WebSocket multiaddrs, e.g. "/dns4/myapp.com/tcp/443/wss"

#### Inherited from

[`NetworkConfig`](../../gossiplog/interfaces/NetworkConfig.md).[`announce`](../../gossiplog/interfaces/NetworkConfig.md#announce)

#### Defined in

packages/gossiplog/lib/interface.d.ts:25

***

### bootstrapList?

> `optional` **bootstrapList**: `string`[]

#### Inherited from

[`NetworkConfig`](../../gossiplog/interfaces/NetworkConfig.md).[`bootstrapList`](../../gossiplog/interfaces/NetworkConfig.md#bootstraplist)

#### Defined in

packages/gossiplog/lib/interface.d.ts:27

***

### contract

> **contract**: `string` \| `T`

#### Defined in

[packages/core/src/Canvas.ts:25](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L25)

***

### listen?

> `optional` **listen**: `string`[]

array of local WebSocket multiaddrs, e.g. "/ip4/127.0.0.1/tcp/3000/ws"

#### Inherited from

[`NetworkConfig`](../../gossiplog/interfaces/NetworkConfig.md).[`listen`](../../gossiplog/interfaces/NetworkConfig.md#listen)

#### Defined in

packages/gossiplog/lib/interface.d.ts:23

***

### maxConnections?

> `optional` **maxConnections**: `number`

#### Inherited from

[`NetworkConfig`](../../gossiplog/interfaces/NetworkConfig.md).[`maxConnections`](../../gossiplog/interfaces/NetworkConfig.md#maxconnections)

#### Defined in

packages/gossiplog/lib/interface.d.ts:29

***

### minConnections?

> `optional` **minConnections**: `number`

#### Inherited from

[`NetworkConfig`](../../gossiplog/interfaces/NetworkConfig.md).[`minConnections`](../../gossiplog/interfaces/NetworkConfig.md#minconnections)

#### Defined in

packages/gossiplog/lib/interface.d.ts:28

***

### path?

> `optional` **path**: `null` \| `string` \| `ClientConfig`

data directory path (NodeJS/sqlite), or postgres connection config (NodeJS/pg)

#### Defined in

[packages/core/src/Canvas.ts:29](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L29)

***

### peerId?

> `optional` **peerId**: [`PeerId`](PeerId.md)

#### Inherited from

[`NetworkConfig`](../../gossiplog/interfaces/NetworkConfig.md).[`peerId`](../../gossiplog/interfaces/NetworkConfig.md#peerid)

#### Defined in

packages/gossiplog/lib/interface.d.ts:30

***

### relayServer?

> `optional` **relayServer**: `string`

#### Inherited from

[`NetworkConfig`](../../gossiplog/interfaces/NetworkConfig.md).[`relayServer`](../../gossiplog/interfaces/NetworkConfig.md#relayserver)

#### Defined in

packages/gossiplog/lib/interface.d.ts:26

***

### reset?

> `optional` **reset**: `boolean`

#### Defined in

[packages/core/src/Canvas.ts:34](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L34)

***

### runtimeMemoryLimit?

> `optional` **runtimeMemoryLimit**: `number`

set a memory limit for the quickjs runtime, only used if `contract` is a string

#### Defined in

[packages/core/src/Canvas.ts:32](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L32)

***

### signers?

> `optional` **signers**: [`SessionSigner`](../../interfaces/interfaces/SessionSigner.md)\<`any`\>[]

#### Defined in

[packages/core/src/Canvas.ts:26](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L26)

***

### start?

> `optional` **start**: `boolean`

#### Inherited from

[`NetworkConfig`](../../gossiplog/interfaces/NetworkConfig.md).[`start`](../../gossiplog/interfaces/NetworkConfig.md#start)

#### Defined in

packages/gossiplog/lib/interface.d.ts:21

***

### topic?

> `optional` **topic**: `string`

#### Defined in

[packages/core/src/Canvas.ts:24](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/core/src/Canvas.ts#L24)
