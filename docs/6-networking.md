# Networking

Once you've deployed your application, you can also use libp2p to check who your application is connected to,
and who else is running the same application.

Unless configured otherwise, apps start with libp2p enabled, so they will try to connect to the network immediately.

## Table of contents

- [Checking connection status](#checking-connection-status)
- [Configuring realtime presence](#configuring-realtime-presence)
- [Listing online peers](#listing-online-peers)
- [Listing online peers across applications](#listing-online-peers-across-applications)

## Checking connection status

For realtime applications, you can check `app.status` to see if your application is connected to other peers.

The app's status will show `connected` as soon as libp2p has a connection to at least one peer running the
same application on the network.

Listen to the `connections:updated` event to detect when this happens:

```ts{7}
import { useCanvas } from "@canvas-js/hooks"
import type { Connections } from "@canvas-js/core"

const { app } = useCanvas({ contract })

useEffect(() => {
  app?.addEventListener("connections:updated", ({ detail: { connections } }) => {
    console.log(app?.status)
    // 'connected'

    console.log(connections)
    // [{
    //   12D3KooWQW2V7moLojFaScKMza3mMqrvvQm9cEgwgyRnr271Z4tX: {
    //     connections: [ConnectionImpl],
    //     peer: Ed25519PeerIdImpl,
    //     status: "online"
    //   }
    // }]
  })
}, [app])
```

The `connections` object lists all peers that you are directly connected to. Peers that are actively sending and receiving actions for the application will be shown as `online` (🟢). Peers passively participating in the mesh will be `waiting` (⚪️), those still connecting will be `connecting` (🟡), and unresponsive peers will be shown as `disconnected` (🔴). As long as at least one peer is `online`, the application will show as connected.

You can see an example [here](https://github.com/canvasxyz/canvas/blob/main/examples/chat/src/ConnectionStatus.tsx#L129).

## Configuring realtime presence

We also maintain a libp2p discovery/presence service that keeps track of the entire set of peers for a given application that are online, including peers that you aren't directly connected to.

To use realtime presence, first set a `discoveryTopic` in your application configuration.

```ts{7}
const { app } = useCanvas({
  contract: {
    topic: "my-app-room-x",
    // models: ...
    // actions: ...
  },
  discoveryTopic: 'my-app-discovery',
})
```

You can think of each contract as an individual room in an application; the discovery topic is a meta-topic that coordinates all of them. (You can configure the discovery topic to be the same as the contract topic, if your application has just one partition.)

With `discoveryTopic` configured, your applications will automatically broadcast presence events across the submesh. Listen for the `presence:join` and `presence:leave` events to see when peers join:

```ts{16}
const handlePresenceListUpdated = ({ detail: { peerId, peers } }) => {
  console.log(peerId)
  // '12D3KooWCQQz7uozb287GZCRGv7DrrZTVDuUfh2bNCd3rpUHgpes'

  console.log(peers)
  // {
  //   12D3KooWCQQz7uozb287GZCRGv7DrrZTVDuUfh2bNCd3rpUHgpes: {
  //     address: null,
  //     env: "server",
  //     lastSeen: 1703317637626,
  //     topics: ["my-app-room-1"]
  // }
}

useEffect(() => {
  app?.addEventListener("presence:join", handlePresenceListUpdated)
  return () => app?.removeEventListener("presence:join", handlePresenceListUpdated)
})
```

Join events will be triggered whenever someone new joins the network, and leave events
will be triggered after that peer goes offline, after about a minute of inactivity.

## Listing online peers

The event also provides a `peers` list, which shows a list of online peers:

- `address` is the public address of the user behind this online peer. For an Ethereum signer,
  this will be a CAIP-2 Ethereum address in the form `eip155:1:0xabc`. Note that this address is
  self-attested and not cryptographically verified (yet).
- `env` is the environment that peer is running in, either `browser` or `server`.
- `lastSeen` is the milliseconds since the last heartbeat from this peer.
- `topics` is the list of topics the peer is subscribed to.

To get a list of other online users, you should filter the list of peers down to those where
`peer.env === 'browser'`.

To only show peers when they have proactively sent a heartbeat, filter the list with
`peer.lastSeen !== null`. This will cause your list of online peers to fill from scratch
when you start the application, as if you were starting a BitTorrent client or P2P node.

By default, we try to load peers from other peers' presence cache, so that you can see a
list of recently active peers.

## Listing online peers across applications

To track presence status across apps on a discovery topic, configure the application
with `trackAllPeers: true`.

```ts{8}
const { app } = useCanvas({
  contract: {
    topic: "my-app-room-x",
    // models: ...
    // actions: ...
  },
  discoveryTopic: 'my-app-discovery',
  trackAllPeers: true,
})
```

This will cause `presence:join` events to be emitted for all peers that join the discovery
topic, even if they have a different app topic. Check the event's `topics` list to see
which application(s) the peer is running.
