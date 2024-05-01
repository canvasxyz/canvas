# @canvas-js/probe-server

Server that provides logging for a single discovery topic.

## Usage

```
npm run start
```

or

```
PEER_ID=... npm run start
```

Configure the replication server using environment variables:

- DISCOVERY_TOPIC: A discovery topic to track, by default `canvas-discovery`.
- LISTEN: An interface to listen on, by default `/ip4/127.0.0.1/tcp/8080/ws`.
- PEER_ID: A fixed peer ID, which you can generate using `./create-peer-id.js`. Otherwise a random one will be generated.
- ANNOUNCE: An address to announce on.
- BOOTSTRAP_LIST: A list of multiaddrs to use as a bootstrap list.

```
[
    "/dns4/canvas-chat-discovery-p0.fly.dev/tcp/443/wss/p2p/12D3KooWG1zzEepzv5ib5Rz16Z4PXVfNRffXBGwf7wM8xoNAbJW7",
    "/dns4/canvas-chat-discovery-p1.fly.dev/tcp/443/wss/p2p/12D3KooWNfH4Z4ayppVFyTKv8BBYLLvkR1nfWkjcSTqYdS4gTueq",
    "/dns4/canvas-chat-discovery-p2.fly.dev/tcp/443/wss/p2p/12D3KooWRBdFp5T1fgjWdPSCf9cDqcCASMBgcLqjzzBvptjAfAxN",
]
```

## Troubleshooting

To connect to a running replication server, you can use the Fly console, e.g.:

```
fly ssh console --app=canvas-chat-probe
```
