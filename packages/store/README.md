# @canvas-js/store

`@canvas-js/store` is a **persistent replicated event log** built on [Okra](https://github.com/canvasxyz/okra-js) and [libp2p](https://github.com/libp2p/js-libp2p). Stores have a strong **reliable delivery** guarantee, although events may be delivered in any order, and in rare cases more than once.

## Overview

```ts
import type { Libp2p } from "@libp2p/interface-libp2p"
import type { PubSub } from "@libp2p/interface-pubsub"
import type { PeerId } from "@libp2p/interface-peer-id"
import type { Node } from "@canvas-js/okra"

type Consumer<T> = (key: Uint8Array, event: T) => void | Promise<void>

type StoreEvents = { sync: CustomEvent<{ peerId: PeerId; root: Node }> }

interface Store<T = unknown> extends EventEmitter<StoreEvents> {
	topic: string
	libp2p: Libp2p<{ pubsub: PubSub }>

	start(): Promise<void> // stores are not started automatically
	stop(): Promise<void>

	attach(consumer: Consumer<T>, options?: { replay?: boolean }): void
	detach(consumer: Consumer<T>): void

	publish(event: T): Promise<{ key: Uint8Array; recipients: number }>
	get(key: Uint8Array): Promise<T | null>
}
```

### Delivery

Stores are identified by a global `topic` string, and use libp2p to find other peers on their topic. Events are delivered via [GossipSub](https://github.com/ChainSafe/js-libp2p-gossipsub), a scalable self-organizing pubsub system with some basic Sybill-resistance heuristics built-in.

GossipSub doesn't guarantee reliable delivery, so events are also indexed in a prolly tree. This allows peers to efficiently synchronize their entire store using a "merkle sync" protocol. Whenever a new peer connection is opened, stores immediately initiates a merkle sync to identify any missing events.

### Consumers

Stores deliver events via _consumers_, which are async event handlers that can be attached and detached at any time. However, to preserve reliable delivery, consumers should be attached before calling `store.start()`. Attaching a consumer with `{ replay: true }` will invoke the handler with every event in the store, along with new events as they come in.

Events are processed by the consumers _before_ they are committed to storage. If any of the consumers throw an error, the event is discarded and not persisted. In practice, this means that the event will be re-discovered during the next merkle sync, and tried again until all active consumers process the event successfully. If you are performing side effects inside your consumers, you may want to use the `key` to make sure you don't do something twice.

### Configuration

All store implementations are configured using an `init: StoreInit<T>` object. Only a `libp2p` peer and a `topic` string are required.

```ts
interface StoreInit<T> extends StoreOptions {
	libp2p: Libp2p<{ pubsub: PubSub }>
	topic: string
	encoding?: Encoding<T>
	validate?: (key: Uint8Array, event: T) => void | Promise<void>
}

interface StoreOptions {
	minConnections?: number
	maxConnections?: number
	maxInboundStreams?: number
	maxOutboundStreams?: number
}

interface Encoding<T> {
	keyToString: (key: Uint8Array) => string
	encode: (event: T) => [key: Uint8Array, value: Uint8Array]
	decode: (value: Uint8Array) => [key: Uint8Array, event: T]
}
```

#### Encoding

The `encoding` configures how events encode and decode to and from bytes, as well as how to deterministically derive a unique `key: Uint8Array` for each event. The default encoding uses [`dag-cbor`](https://github.com/ipld/js-dag-cbor) with CIDs for keys, and supports the [IPLD data model](https://ipld.io/docs/data-model/): `null`, `boolean`, `number`, `string`, `Uint8Array`, CIDs, objects, and arrays.

The keys yielded by the encoding are used by the prolly tree, which means events are stored in lexicographic key order. This is the order that `{ replay: true }` consumers will receive existing events, and is also the order that missing events will be discovered during merkle sync.

The default encoding uses hashes for keys, which effectively sorts events in a random order. This can negatively impact the performance of merkle sync, which is more efficient if missing events are clustered together and less efficient if missing events are distributed throughout the key range. If your events have a timestamp/version number/vector clock or some other fixed-size ordered value, consider providing a custom encoding that yields keys with ordered prefixes.

You can create a simple ordered encoding with the `createOrderedEncoding` utility function. Here's an example that prefixes keys with 6-byte big-endian timestamp:

```ts
import { openStore } from "@canvas-js/store/node"
import { createOrderedEncoding } from "@canvas-js/store"

type MyEvent = { timestamp: number; ... }

const store = await openStore<MyEvent>({
  libp2p: libp2p,
  topic: "com.example.app",
  encoding: createOrderedEncoding({
    prefixByteLength: 6,
    getPrefix: (event) => {
      const key = Buffer.alloc(6)
      key.writeUintBE(event.timestamp, 0, 6)
      return key
    },
  }),
})

// now events are sorted by [timestamp, hash] instead of just [hash]
```

The prefix must be fixed-size; `getPrefix` must always return a `Uint8Array` with a byte length of `prefixByteLength`.

You can also implement the `Encoding` interface from scratch. The only requirements are that encoding is canonical and stable, and that keys are deterministic and unique.

#### Validation

You can optionally provide a `validate: (key: Uint8Array, event: T) => Promise<void>` function that will be called before events are passed to the consumers. If it throws an error, the event will be discarded and the sender penalized.

An alternative is to do validation inside the consumers, since they have the same behavior (events are discarded if any consumer throws an error). The difference is just that `validate` is provided up-front inside the `init` object, and is only called once for each event.

> ⚠️ If your libp2p node is connected to the open internet, your validation logic is the only thing stopping strangers from storing arbitrary data on your computer.

### Platforms

This package has separate store implementations for NodeJS and the browser, and another in-memory store for testing purposes. They have separate import paths, but all export a single async `openStore` function.

#### NodeJS

The NodeJS implementation is backed by an on-disk LMDB database. Pass a data directory name as the first argument to `openStore`.

```ts
import { createLibp2p } from "libp2p"
import { openStore } from "@canvas-js/store/node"

const libp2p = await createLibp2p({ ... })

const store = await openStore("./data", {
  topic: "com.example.app",
  libp2p: libp2p,
})

await store.start()
```

#### Browser

The browser implementation is backed by an IndexedDB database. Pass a database name as the first argument to `openStore`. It will be created if it doesn't exist; don't use it for anything else.

```ts
import { createLibp2p } from "libp2p"
import { openStore } from "@canvas-js/store/browser"

const libp2p = await createLibp2p({ ... })

const store = await openStore("events", {
  topic: "com.example.app",
  libp2p: libp2p
})

await store.start()
```

#### Memory

The in-memory implementation is backed by a pure-JS r/b tree.

```ts
import { createLibp2p } from "libp2p"
import { openStore } from "@canvas-js/store/memory"

const libp2p = await createLibp2p({ ... })

const store = await openStore({
  topic: "com.example.app",
  libp2p: libp2p
})

await store.start()
```
