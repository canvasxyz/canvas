# @canvas-js/discovery

This is a general-purpose discovery and presence service for Canvas peers.

## Peer Discovery

Bootstrap peers, replication servers, and browser peers all use `@canvas-js/discovery` to identify other peers on the network and find each other.

The libp2p framework allows for [different implementations](https://docs.libp2p.io/concepts/discovery-routing/overview/) of peer discovery mechanisms, like DHT queries (used by IPFS), fixed bootstrap lists, local network discovery, etc. However, DHTs are slow and computationally expensive to maintain.

We have implemented two forms of peer discovery which are suited to realtime applications:

1. In **passive** discovery, peers use the libp2p `fetch` protocol to query their existing connections for additional peers
2. In **active** discovery, peers broadcast regular heartbeat messages via GossipSub on a dedicated "discovery topic"

Peers run either passive discovery, or passive+active discovery.

## Discovery Topics

You can enable active discovery by configuring a `discoveryTopic`.

You must provide your own discovery topic; there isn't a shared global topic across all Canvas applications. You can re-use an app topic for discovery, or might want to use a separate discovery topic for a family of related app topics.

If you use a shared discovery topic, presence information will be shared across applications. This is useful for seeing player count in different lobbies in a game, who is in adjacent rooms in a multi-user dungeon, etc.

Not all peers of an app have to be doing the same thing; it might make sense to have replication servers participate in active+passive discovery, and have browser peers only run passive discovery.

## Presence

If you enable active discovery by setting a `discoveryTopic`, the active discovery service will make its best effort to compile a list of all `browser` and `server` peers on the network. If you filter this down to browser peers, you can use this to show realtime presence status of who else is using your application.

Presence status is exposed through `join` and `leave` events. For passive discovery, these only track local-neighborhood peers (ie they're only emitted for peers we directly connect to and disconnect from). For passive+active discovery, they track all peers through their heartbeats on the discovery topic.
