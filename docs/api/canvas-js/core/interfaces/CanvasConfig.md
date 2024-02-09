[@canvas-js/core](../index.md) / CanvasConfig

# Interface: CanvasConfig\<T\>

## Extends

- [`NetworkConfig`](NetworkConfig.md)

## Type parameters

• **T** extends [`Contract`](../type-aliases/Contract.md) = [`Contract`](../type-aliases/Contract.md)

## Properties

### announce?

> **`optional`** **announce**: `string`[]

array of public WebSocket multiaddrs, e.g. "/dns4/myapp.com/tcp/443/wss"

#### Inherited from

[`NetworkConfig`](NetworkConfig.md).[`announce`](NetworkConfig.md#announce)

#### Source

[packages/core/src/Canvas.ts:31](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L31)

***

### bootstrapList?

> **`optional`** **bootstrapList**: `string`[]

#### Inherited from

[`NetworkConfig`](NetworkConfig.md).[`bootstrapList`](NetworkConfig.md#bootstraplist)

#### Source

[packages/core/src/Canvas.ts:33](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L33)

***

### contract

> **contract**: `string` \| `T`

#### Source

[packages/core/src/Canvas.ts:46](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L46)

***

### disablePing?

> **`optional`** **disablePing**: `boolean`

#### Inherited from

[`NetworkConfig`](NetworkConfig.md).[`disablePing`](NetworkConfig.md#disableping)

#### Source

[packages/core/src/Canvas.ts:25](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L25)

***

### discoveryInterval?

> **`optional`** **discoveryInterval**: `number`

#### Inherited from

[`NetworkConfig`](NetworkConfig.md).[`discoveryInterval`](NetworkConfig.md#discoveryinterval)

#### Source

[packages/core/src/Canvas.ts:38](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L38)

***

### discoveryTopic?

> **`optional`** **discoveryTopic**: `string`

#### Inherited from

[`NetworkConfig`](NetworkConfig.md).[`discoveryTopic`](NetworkConfig.md#discoverytopic)

#### Source

[packages/core/src/Canvas.ts:37](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L37)

***

### enableWebRTC?

> **`optional`** **enableWebRTC**: `boolean`

#### Inherited from

[`NetworkConfig`](NetworkConfig.md).[`enableWebRTC`](NetworkConfig.md#enablewebrtc)

#### Source

[packages/core/src/Canvas.ts:42](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L42)

***

### ignoreMissingActions?

> **`optional`** **ignoreMissingActions**: `boolean`

#### Source

[packages/core/src/Canvas.ts:58](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L58)

***

### indexHistory?

> **`optional`** **indexHistory**: `boolean`

set to `false` to disable history indexing and db.get(..) within actions

#### Source

[packages/core/src/Canvas.ts:56](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L56)

***

### libp2p?

> **`optional`** **libp2p**: `Libp2p`\<`ServiceMap`\>

provide an existing libp2p instance instead of creating a new one

#### Source

[packages/core/src/Canvas.ts:53](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L53)

***

### listen?

> **`optional`** **listen**: `string`[]

array of local WebSocket multiaddrs, e.g. "/ip4/127.0.0.1/tcp/3000/ws"

#### Inherited from

[`NetworkConfig`](NetworkConfig.md).[`listen`](NetworkConfig.md#listen)

#### Source

[packages/core/src/Canvas.ts:28](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L28)

***

### maxConnections?

> **`optional`** **maxConnections**: `number`

#### Inherited from

[`NetworkConfig`](NetworkConfig.md).[`maxConnections`](NetworkConfig.md#maxconnections)

#### Source

[packages/core/src/Canvas.ts:35](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L35)

***

### minConnections?

> **`optional`** **minConnections**: `number`

#### Inherited from

[`NetworkConfig`](NetworkConfig.md).[`minConnections`](NetworkConfig.md#minconnections)

#### Source

[packages/core/src/Canvas.ts:34](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L34)

***

### offline?

> **`optional`** **offline**: `boolean`

#### Inherited from

[`NetworkConfig`](NetworkConfig.md).[`offline`](NetworkConfig.md#offline)

#### Source

[packages/core/src/Canvas.ts:24](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L24)

***

### path?

> **`optional`** **path**: `null` \| `string`

data directory path (NodeJS only)

#### Source

[packages/core/src/Canvas.ts:50](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L50)

***

### presenceTimeout?

> **`optional`** **presenceTimeout**: `number`

#### Inherited from

[`NetworkConfig`](NetworkConfig.md).[`presenceTimeout`](NetworkConfig.md#presencetimeout)

#### Source

[packages/core/src/Canvas.ts:40](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L40)

***

### runtimeMemoryLimit?

> **`optional`** **runtimeMemoryLimit**: `number`

#### Source

[packages/core/src/Canvas.ts:57](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L57)

***

### signers?

> **`optional`** **signers**: `SessionSigner`\<`any`\>[]

#### Source

[packages/core/src/Canvas.ts:47](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L47)

***

### trackAllPeers?

> **`optional`** **trackAllPeers**: `boolean`

#### Inherited from

[`NetworkConfig`](NetworkConfig.md).[`trackAllPeers`](NetworkConfig.md#trackallpeers)

#### Source

[packages/core/src/Canvas.ts:39](https://github.com/canvasxyz/canvas/blob/9c725016/packages/core/src/Canvas.ts#L39)
