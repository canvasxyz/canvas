[@canvas-js/core](../index.md) / Connection

# Interface: Connection

A Connection is a high-level representation of a connection
to a remote peer that may have been secured by encryption and
multiplexed, depending on the configuration of the nodes
between which the connection is made.

## Properties

### direction

> **direction**: `Direction`

Outbound conections are opened by the local node, inbound streams are opened by the remote

#### Source

node\_modules/@libp2p/interface/dist/src/connection/index.d.ts:224

***

### encryption?

> **`optional`** **encryption**: `string`

The encryption protocol negotiated for this connection

#### Source

node\_modules/@libp2p/interface/dist/src/connection/index.d.ts:236

***

### id

> **id**: `string`

The unique identifier for this connection

#### Source

node\_modules/@libp2p/interface/dist/src/connection/index.d.ts:204

***

### log

> **log**: `Logger`

The connection logger

#### Source

node\_modules/@libp2p/interface/dist/src/connection/index.d.ts:264

***

### multiplexer?

> **`optional`** **multiplexer**: `string`

The multiplexer negotiated for this connection

#### Source

node\_modules/@libp2p/interface/dist/src/connection/index.d.ts:232

***

### remoteAddr

> **remoteAddr**: `Multiaddr`

The address of the remote end of the connection

#### Source

node\_modules/@libp2p/interface/dist/src/connection/index.d.ts:208

***

### remotePeer

> **remotePeer**: [`PeerId`](../type-aliases/PeerId.md)

The id of the peer at the remote end of the connection

#### Source

node\_modules/@libp2p/interface/dist/src/connection/index.d.ts:212

***

### status

> **status**: `ConnectionStatus`

The current status of the connection

#### Source

node\_modules/@libp2p/interface/dist/src/connection/index.d.ts:240

***

### streams

> **streams**: `Stream`[]

A list of open streams on this connection

#### Source

node\_modules/@libp2p/interface/dist/src/connection/index.d.ts:220

***

### tags

> **tags**: `string`[]

A list of tags applied to this connection

#### Source

node\_modules/@libp2p/interface/dist/src/connection/index.d.ts:216

***

### timeline

> **timeline**: `ConnectionTimeline`

Lifecycle times for the connection

#### Source

node\_modules/@libp2p/interface/dist/src/connection/index.d.ts:228

***

### transient

> **transient**: `boolean`

A transient connection is one that is not expected to be open for very long
or one that cannot transfer very much data, such as one being used as a
circuit relay connection. Protocols need to explicitly opt-in to being run
over transient connections.

#### Source

node\_modules/@libp2p/interface/dist/src/connection/index.d.ts:247

## Methods

### abort()

> **abort**(`err`): `void`

Immediately close the connection, any queued data will be discarded

#### Parameters

• **err**: `Error`

#### Returns

`void`

#### Source

node\_modules/@libp2p/interface/dist/src/connection/index.d.ts:260

***

### close()

> **close**(`options`?): `Promise`\<`void`\>

Gracefully close the connection. All queued data will be written to the
underlying transport.

#### Parameters

• **options?**: `AbortOptions`

#### Returns

`Promise`\<`void`\>

#### Source

node\_modules/@libp2p/interface/dist/src/connection/index.d.ts:256

***

### newStream()

> **newStream**(`protocols`, `options`?): `Promise`\<`Stream`\>

Create a new stream on this connection and negotiate one of the passed protocols

#### Parameters

• **protocols**: `string` \| `string`[]

• **options?**: `NewStreamOptions`

#### Returns

`Promise`\<`Stream`\>

#### Source

node\_modules/@libp2p/interface/dist/src/connection/index.d.ts:251
