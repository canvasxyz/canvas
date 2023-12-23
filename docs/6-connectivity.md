# Presence & Connectivity

We also support realtime features like multiplayer presence.

## Connection status

If you're building realtime applications, your users might expect their actions to be instantly seen by others. Sometimes this might not happen because of issues like intermittent wifi or switching between networks.

You can check `app.status`, which will be `connected` or `disconnected` depending on if the application is able to reach at least one peer running the same application  on the network.

You can also subscribe to the `connections:updated` event for changes in status:

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

The `connections` object lists all peers that you are directly connected to. Peers that are actively sending and receiving actions for the application will be shown as `online` (🟢). Peers passively participating in the mesh will be shown as `waiting` (⚪️), those still connecting will be shown as `connecting` (🟡), and unresponsive peers will be shown as `disconnected` (🔴). [See an example here](https://github.com/canvasxyz/canvas/blob/main/examples/chat/src/ConnectionStatus.tsx#L129).

As long as at least one peer is `online`, the application will show as connected.

## Realtime presence

Our presence features in the discovery module make it possible to see who else is online for a given application.

To use the presence features, first configure a discovery topic:

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

A discovery topic is a topic shared between multiple contract instances running on different topics. You can think of each contract as an individual chat room or shard of an application; the discovery topic is a meta-topic that coordinates all of them.

With `discoveryTopic` configured, your applications will automatically broadcast presence events to each other.

Now listen for the `presence:join` and `presence:leave` events:

```ts
const handlePresenceListUpdated = ({ detail: { peerId, peers } }) => {
  // the peer that just joined or left:
  console.log(peerId)

  // the updated full list of peers:
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
  app?.addEventListener("presence:leave", handlePresenceListUpdated)
  return () => {
    app?.removeEventListener("presence:join", handlePresenceListUpdated)
    app?.removeEventListener("presence:leave", handlePresenceListUpdated)
  }
})
```

Join events will be broadcast whenever someone new joins the network, and leave events
will be triggered locally after that peer goes offline, after about a minute of inactivity.

```ts
{
  '12D3KooWCQQz7uozb287GZCRGv7DrrZTVDuUfh2bNCd3rpUHgpes': {
    address: null,
    env: "server",
    lastSeen: 1703317637626
  }
}
```

Both events include a `peers` list, which shows the latest list of who's online. Each peer
has these fields:

- `address` is the public address of the user behind this online peer. For an Ethereum signer,
  this will be a CAIP-2 Ethereum address in the form `eip155:1:0xabc`. Note that this address is
  self-attested and not cryptographically verified, so don't rely on it for security (yet).
- `env` is the environment that peer is running in. Only other browser clients
  will have `"browser"` as their environment; servers and hosted nodes will have `"server"`.
- `lastSeen` is the milliseconds since the last heartbeat from this peer.

You will probably wish to filter this list down to just `browser` nodes, that are interested
in your specific application topic.

(TODO: example)

### How presence works

Presence events are broadcast when a peer first connects to the network, then every minute thereafter. If a peer goes missing for more than about 1m 30s, then it will be removed from the presence list.

Presence events are sent using pubsub to the entire mesh. This means that they reach everyone using the application, not just peers that you're directly connected to.
