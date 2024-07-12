[Documentation](../../../packages.md) / [@canvas-js/gossiplog](../index.md) / NetworkConfig

# Interface: NetworkConfig

## Extended by

## Properties

### announce?

> `optional` **announce**: `string`[]

array of public WebSocket multiaddrs, e.g. "/dns4/myapp.com/tcp/443/wss"

#### Defined in

[packages/gossiplog/src/interface.ts:31](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/interface.ts#L31)

***

### bootstrapList?

> `optional` **bootstrapList**: `string`[]

#### Defined in

[packages/gossiplog/src/interface.ts:34](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/interface.ts#L34)

***

### listen?

> `optional` **listen**: `string`[]

array of local WebSocket multiaddrs, e.g. "/ip4/127.0.0.1/tcp/3000/ws"

#### Defined in

[packages/gossiplog/src/interface.ts:28](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/interface.ts#L28)

***

### maxConnections?

> `optional` **maxConnections**: `number`

#### Defined in

[packages/gossiplog/src/interface.ts:36](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/interface.ts#L36)

***

### minConnections?

> `optional` **minConnections**: `number`

#### Defined in

[packages/gossiplog/src/interface.ts:35](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/interface.ts#L35)

***

### peerId?

> `optional` **peerId**: [`PeerId`](../../core/interfaces/PeerId.md)

#### Defined in

[packages/gossiplog/src/interface.ts:37](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/interface.ts#L37)

***

### relayServer?

> `optional` **relayServer**: `string`

#### Defined in

[packages/gossiplog/src/interface.ts:33](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/interface.ts#L33)

***

### start?

> `optional` **start**: `boolean`

#### Defined in

[packages/gossiplog/src/interface.ts:25](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/gossiplog/src/interface.ts#L25)
