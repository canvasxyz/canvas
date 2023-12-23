# Deployment Considerations

## Table of Contents

- [Show the connection status](#show-the-connection-status)
- [Consider turning sequencing off](#consider-turning-sequencing-off)
- [Keep WebRTC transports off](#keep-webrtc-transports-off)
- [Universal replication servers](#universal-replication-servers)

## Show the connection status

Keep track of `app.status` to detect whether the application has a reliable connection to its peers. It will show as `connected` when the application is able to ping at least one online peer, and `disconnected` otherwise.

To subscribe to changes to the connection status, you can listen for a `connections:updated` event with `app.addEventListener("connections:updated")`.

This event is also emitted with a `connections` object, which can be used to [list all peers](https://canvas-chat.pages.dev/) your application is connected to. Only peers that are actively sending and receiving actions for this application will be shown as `connected` (🟢), while peers passively participating in the mesh will be shown as `waiting` (⚪️)., and unresponsive peers will be shown as `disconnected` (🔴). ([Example](https://github.com/canvasxyz/canvas/blob/46bef2263d6e7ec9b746ced2c47da52cb7d8190b/examples/chat/src/ConnectionStatus.tsx#L65))

## Consider turning sequencing off

By default, applications are configured with sequencing ("history indexing") on, which ensures that actions are delivered in exact causal order.

When your application doesn't depend on actions executing in exact order, you can turn this off for better performance. This prevents applications from stalling if a user sends a message while they're on a transient or flaky internet connection.

You can do this by setting `indexHistory: false` when configuring your application. This causes all actions to be executed in realtime as they are received. ([Example](https://github.com/canvasxyz/canvas/blob/46bef2263d6e7ec9b746ced2c47da52cb7d8190b/examples/chat/src/App.tsx#L48))

Note that doing this also disables `db.get()` getters inside actions, because atomic transactions require consistent order of delivery.

## Keep WebRTC transports off

Canvas applications can run over both WebSockets and browser-to-browser WebRTC, but for production applications, we recommend using only WebSockets for reliability.

WebRTC is now disabled by default, unless you set `enableWebRTC: true`.

This means that your application will need a WebSocket server, e.g. an instance of your application running in Node.js or the Canvas CLI, or on a server hosted by someone else.

## Universal replication servers

Instead of running your own WebSocket server, you can use a universal replication server.

Universal replication servers are configured to replicate **groups of applications** that connect to them, and will replicate **any action** sent to them. They can be used as a backend for fleets of chat rooms, direct messages, minigames, etc.

Each universal replication server is configured with a specific discovery topic, a meta-topic that coordinates presence and peer discovery across applications.

We provide a set of universal replication servers for the `canvas-discovery` topic, at `canvas-chat-discovery-p0.fly.dev`, `canvas-chat-discovery-p1.fly.dev`, and `canvas-chat-discovery-p2.fly.dev` with fixed peer IDs.

| server | multiaddr |
| ------ | --------- |
| canvas-chat-discovery-p0.fly.dev | /dns4/canvas-chat-discovery-p0.fly.dev/tcp/443/wss/p2p/12D3KooWG1zzEepzv5ib5Rz16Z4PXVfNRffXBGwf7wM8xoNAbJW7 |
| canvas-chat-discovery-p1.fly.dev | /dns4/canvas-chat-discovery-p1.fly.dev/tcp/443/wss/p2p/12D3KooWNfH4Z4ayppVFyTKv8BBYLLvkR1nfWkjcSTqYdS4gTueq |
| canvas-chat-discovery-p2.fly.dev | /dns4/canvas-chat-discovery-p2.fly.dev/tcp/443/wss/p2p/12D3KooWRBdFp5T1fgjWdPSCf9cDqcCASMBgcLqjzzBvptjAfAxN |

You are free to use them for whatever you wish -- they are labeled as chat discovery servers because we intend for them to be used for short-lived chat rooms.

If we reboot or reset these servers, we will stagger when reboots happen across the servers, so no interruptions occur to active chat sessions.

You can use them by adding them to your bootstrap nodes:

```ts
import { defaultBootstrapList } from "@canvas-js/core"
import { useCanvas } from "@canvas-js/hooks"

const { app } = useCanvas({
  contract: {
    topic: "my-app-room-x",
    // models: ...
    // actions: ...
  },
  indexHistory: false,
  discoveryTopic: "canvas-discovery",
  bootstrapList: [
    "/dns4/canvas-chat-discovery-p0.fly.dev/tcp/443/wss/p2p/12D3KooWG1zzEepzv5ib5Rz16Z4PXVfNRffXBGwf7wM8xoNAbJW7",
    "/dns4/canvas-chat-discovery-p1.fly.dev/tcp/443/wss/p2p/12D3KooWNfH4Z4ayppVFyTKv8BBYLLvkR1nfWkjcSTqYdS4gTueq",
    "/dns4/canvas-chat-discovery-p2.fly.dev/tcp/443/wss/p2p/12D3KooWRBdFp5T1fgjWdPSCf9cDqcCASMBgcLqjzzBvptjAfAxN",
    ...defaultBootstrapList
  ]
})
```
