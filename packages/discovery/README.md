# @canvas-js/discovery

This is a general-purpose discovery service for Canvas peers. Bootstrap peers, replication servers, and browser peers all use `@canvas-js/discovery` to find each other.

There are two forms of discovery: active and passive.

1. in **passive** discovery, peers use the libp2p `fetch` protocol to query their existing connections for additional peers
2. in **active** discovery, peers broadcast regular heartbeat messages via GossipSub on a dedicated "discovery topic"

Peers either run passive discovery or passive+active discovery.

For active discovery, there isn't a single global discovery topic. App developers can re-use an app topic for discovery, or might want to use a separate discovery topic for a family of app topics.

Not all peers of an app have to be doing the same thing; it might make sense to only have replication servers participate in active discovery, and have browser peers only do passive discovery.

Both forms of discovery expose real-time presence data through `join` and `leave` events. For passive discovery, these only track local-neighborhood peers (ie they're only emitted for peers we directly connect to and disconnect from). For passive+active discovery, they track all peers through their heartbeats on the discovery topic.
