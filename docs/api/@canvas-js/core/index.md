[Documentation](../../index.md) / @canvas-js/core

# @canvas-js/core

A Canvas app replicates and executes a log of signed actions, sourced from
GossipLog, with read/write access to a ModelDB database.

Use this package directly if you want fine-grained control over when an
application is started/stopped. Otherwise, you can use `useCanvas` in
`@canvas-js/hooks`, which has the same API, but handles initialization
inside React for you.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [API](#api)

## Installation

```
$ npm i @canvas-js/core
```

## Usage

```ts
import { Canvas } from "@canvas-js/core"

const app = await Canvas.initialize({
  contract: {
    topic: "com.example.my-app",
    models: {
      posts: {
        id: "primary",
        user: "string",
        content: "string",
        updated_at: "integer",
      },
    },
    actions: {
      async createPost(db, { content }, { id, chain, address, timestamp }) {
        const user = [chain, address].join(":")
        await db.posts.set({ id, user, content, updated_at: timestamp })
      },
      async deletePost(db, { postId }, { chain, address }) {
        const post = await db.posts.get(postId)
        if (post === null) {
          return
        }

        const user = [chain, address].join(":")
        if (post.user !== user) {
          throw new Error("not authorized")
        }

        await db.posts.delete(postId)
      },
    },
  },
})

await app.actions.createPost({ content: "hello world!" })
const results = await app.db.query("posts", {})
// [
//   {
//     id: '09p5qn7affkhtbflscr663tet8ddeu41',
//     user: 'eip155:1:0x79c5158f81ebb0c2bcF877E9e1813aed2Eb652B7',
//     content: 'hello world!',
//     updated_at: 1698339861041
//   }
// ]
```

## API

### Contract types

```ts
import type { ModelsInit, ModelValue } from "@canvas-js/modeldb"
import type { Awaitable } from "@canvas-js/interfaces"

export type Contract = {
  topic: string
  models: ModelsInit
  actions: Record<string, ActionImplementationFunction | ActionImplementationObject>
}

export type ActionImplementationObject = {
  argsType?: { schema: string; name: string }
  apply: ActionImplementationFunction
}

export type ActionImplementationFunction = (
  db: Record<string, ModelAPI>,
  args: Args,
  context: ActionContext,
) => Awaitable<Result>

export type ModelAPI = {
  get: (key: string) => Promise<T | null>
  set: (value: ModelValue) => Promise<void>
  delete: (key: string) => Promise<void>
}

export type ActionContext = {
  id: string
  chain: string
  address: string
  blockhash: string | null
  timestamp: number
}
```

### `Canvas` class

```ts
import { Signature, Action, Session, SessionSigner } from "@canvas-js/interfaces"
import { AbstractModelDB } from "@canvas-js/modeldb"

export interface NetworkConfig {
    offline?: boolean;
    disablePing?: boolean;
    /** array of local WebSocket multiaddrs, e.g. "/ip4/127.0.0.1/tcp/3000/ws" */
    listen?: string[];
    /** array of public WebSocket multiaddrs, e.g. "/dns4/myapp.com/tcp/443/wss" */
    announce?: string[];
    bootstrapList?: string[];
    minConnections?: number;
    maxConnections?: number;
    discoveryTopic?: string;
    discoveryInterval?: number;
    trackAllPeers?: boolean;
    enableWebRTC?: boolean;
}
export interface CanvasConfig<T extends Contract = Contract> extends NetworkConfig {
    contract: string | T;
    signers?: SessionSigner[];
    /** data directory path (NodeJS only) */
    path?: string | null;
    /** provide an existing libp2p instance instead of creating a new one */
    libp2p?: Libp2p<ServiceMap>;
    /** set to `false` to disable history indexing and db.get(..) within actions */
    indexHistory?: boolean;
    runtimeMemoryLimit?: number;
    ignoreMissingActions?: boolean;
}

export interface CanvasEvents extends GossipLogEvents<Action | Session, unknown> {
    close: Event;
    connect: CustomEvent<{
        peer: PeerId;
    }>;
    disconnect: CustomEvent<{
        peer: PeerId;
    }>;
    "connections:updated": CustomEvent<ConnectionsInfo>;
    "presence:join": CustomEvent<PresenceInfo>;
    "presence:leave": CustomEvent<PresenceInfo>;
}

export declare class Canvas extends EventEmitter<CanvasEvents> {
  public static initialize(config: CanvasConfig): Promise<Canvas>

  public readonly topic: string
  public readonly signers: SessionSigner[]
  public readonly peerId: PeerId
  public readonly libp2p: Libp2p<ServiceMap> | null
  public readonly db: AbstractModelDB

  public readonly actions: Record<
    string,
    (
      args: any,
      options: { chain?: string; signer?: SessionSigner },
    ) => Promise<{ id: string; recipients: Promise<PeerId[]> }>
  >

  public close(): Promise<void>
  public start(): Promise<void>
  public stop(): Promise<void>

  public getMessage(id: string): Promise<[signature: Signature, message: Message<Action | Session>] | [null, null]>
  public getMessageStream(
    lowerBound?: { id: string; inclusive: boolean } | null,
    upperBound?: { id: string; inclusive: boolean } | null,
    options?: { reverse?: boolean },
  ): AsyncIterable<[id: string, signature: Signature, message: Message<Action | Session>]>
}
```
