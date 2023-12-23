# Networking

Once you've deployed your application, you can also use libp2p to check who your application is connected to,
and who else is running the same application.

## Table of contents

- [Checking connection status](#checking-connection-status)
- [Configuring realtime presence](#configuring-realtime-presence)
- [Getting the list of online peers](#listing-online-peers)

## Checking connection status

For realtime applications, you can check `app.status` to see if your application is connected to other peers.

By default, apps start with libp2p enabled, so they will try to connect to the network immediately.
You can set `offline: true` in the config to start libp2p manually instead.

The app's status will show `connected` as soon as libp2p has a connection to at least one peer running the
same application on the network.

Listen to the `connections:updated` event to detect when this happens:

```ts
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

The `connections` object provided with the event lists all peers that you are directly connected to. Peers that are actively sending and receiving actions for the application will be shown as `online` (🟢). Peers passively participating in the mesh will be shown as `waiting` (⚪️), those still connecting will be shown as `connecting` (🟡), and unresponsive peers will be shown as `disconnected` (🔴). As long as at least one peer is `online`, the application will show as connected.

You can see an example [here](https://github.com/canvasxyz/canvas/blob/main/examples/chat/src/ConnectionStatus.tsx#L129).

## Configuring realtime presence

We also maintain a libp2p service that keeps track of the entire set of peers for a given application that are online,
including peers that you aren't connected to.

To use the presence, first set a discovery topic in your application configuration.

You can think of each contract as an individual room or partition of an application; the discovery topic is a meta-topic that coordinates all of them. (You can configure the discovery topic to be the same as the contract topic, if your application has just one partition.)

With `discoveryTopic` configured, your applications will automatically broadcast presence events to each other:

```ts

const { app } = useCanvas({
  contract: {
    topic: "my-app-room-x",
    // models: ...
    // actions: ...
  },
  discoveryTopic: 'my-app-discovery',
})
```

Listen for the `presence:join` and `presence:leave` events to see when peers join or leave:

```ts
const handlePresenceListUpdated = ({ detail: { peerId, peers } }) => {
  console.log(peerId)
  // '12D3KooWCQQz7uozb287GZCRGv7DrrZTVDuUfh2bNCd3rpUHgpes'

  console.log(peers)
  // {
  //   12D3KooWCQQz7uozb287GZCRGv7DrrZTVDuUfh2bNCd3rpUHgpes: {
  //     address: null,
  //     env: "server",
  //     lastSeen: 1703317637626
  // }
}

useEffect(() => {
  app?.addEventListener("presence:join", handlePresenceListUpdated)
  return () => app?.removeEventListener("presence:join", handlePresenceListUpdated)
})
```

Join events will be broadcast whenever someone new joins the network, and leave events
will be triggered after that peer goes offline, after about a minute of inactivity.

## Listing online peers

The event also provides a `peers` list, which shows a list of online peers:

- `address` is the public address of the user behind this online peer. For an Ethereum signer,
  this will be a CAIP-2 Ethereum address in the form `eip155:1:0xabc`. Note that this address is
  self-attested and not cryptographically verified (yet).
- `env` is the environment that peer is running in, either `browser` or `server`.
- `lastSeen` is the milliseconds since the last heartbeat from this peer.
- `topics` is the list of topics the peer is subscribed to.

You may wish to filter the list of peers down to those 1) running in the browser,
and 2) subscribed to the same application topic(s) that you are running.