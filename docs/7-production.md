---
title: "Deploying"
---

# Deployment Tips

## Ensure realtime delivery of actions

By default, applications are configured with sequencing (aka history indexing) on, which ensures that actions are delivered in exact order.

For realtime applications, we recommend turning it off, by setting `indexHistory: false` when you configure your application. [See an example.](https://github.com/canvasxyz/canvas/blob/46bef2263d6e7ec9b746ced2c47da52cb7d8190b/examples/chat/src/App.tsx#L48)

This will make it so that if someone sends a message when their internet connection is flaky, further actions won't be blocked on that action being successfully repropagated, which may happen after a delay of 15-30 seconds or more (when the next history sync is run).

## Show the connection status

For realtime applications, you can get the user's connection status, and use it to block user inputs whenever the application is offline.

Use `app.status` to detect when your app has an online connection, which will be either `connected` or `disconnected`.

To subscribe to changes to the connectivity status, listen for a connections:updated event with `app.addEventListener("connections:updated")`.

The event will also provide you with a `connections` object, which can be used to [list all the peers](https://canvas-chat.pages.dev/) that your application is connected to.

## Keep WebRTC transports off

Canvas applications can run over both WebSockets and browser-to-browser WebRTC, but for realtime applications, we recommend using only WebSockets for reliability. As of version 0.7.2, WebRTC transports are now disabled by default, unless you set `enableWebRTC: true`.

This also means that your application will need to talk to a WebSocket server, e.g. an instance of your application running in Node.js or the Canvas CLI, or a server hosted by someone else.

## Universal replication servers

Instead of running your own WebSocket server, you can use a universal replication server.

Universal replication servers are configured to replicate **groups of applications** that connect to them. They can be used as a backend for fleets of chat rooms, direct messages, minigames, etc.

Each set of universal replication servers is configured with a specific discovery topic, a meta-topic that coordinates presence and peer discovery across applications.

We provide a set of universal replication servers for the `canvas-discovery` topic, at `canvas-chat-discovery-p0.fly.dev`, `canvas-chat-discovery-p1.fly.dev`, and `canvas-chat-discovery-p2.fly.dev` with fixed peer IDs.

| server | multiaddr |
| ------ | --------- |
| canvas-chat-discovery-p0.fly.dev | /dns4/canvas-chat-discovery-p0.fly.dev/tcp/443/wss/p2p/12D3KooWG1zzEepzv5ib5Rz16Z4PXVfNRffXBGwf7wM8xoNAbJW7 |
| canvas-chat-discovery-p1.fly.dev | /dns4/canvas-chat-discovery-p1.fly.dev/tcp/443/wss/p2p/12D3KooWNfH4Z4ayppVFyTKv8BBYLLvkR1nfWkjcSTqYdS4gTueq |
| canvas-chat-discovery-p2.fly.dev | /dns4/canvas-chat-discovery-p2.fly.dev/tcp/443/wss/p2p/12D3KooWRBdFp5T1fgjWdPSCf9cDqcCASMBgcLqjzzBvptjAfAxN |

You are free to use these for whatever you wish -- these are labeled as chat discovery servers because we intend for them to be used for ephemeral chat rooms, where history might be cleared after some time.

If we reboot or reset these servers, we will stagger when it happens, so no interruptions occur to active chat sessions.

You can use these servers by adding them to your bootstrap nodes:

```ts
import { defaultBootstrapList } from "@canvas-js/core"
import { useCanvas } from "@canvas-js/hooks"

const { app } = useCanvas({
  contract: {
    topic: "my-app-room-x",
    // models: ...
    // actions: ...
  },
  discoveryTopic: "canvas-discovery",
  bootstrapList: [
    "/dns4/canvas-chat-discovery-p0.fly.dev/tcp/443/wss/p2p/12D3KooWG1zzEepzv5ib5Rz16Z4PXVfNRffXBGwf7wM8xoNAbJW7",
    "/dns4/canvas-chat-discovery-p1.fly.dev/tcp/443/wss/p2p/12D3KooWNfH4Z4ayppVFyTKv8BBYLLvkR1nfWkjcSTqYdS4gTueq",
    "/dns4/canvas-chat-discovery-p2.fly.dev/tcp/443/wss/p2p/12D3KooWRBdFp5T1fgjWdPSCf9cDqcCASMBgcLqjzzBvptjAfAxN",
    ...defaultBootstrapList
  ]
})
```
