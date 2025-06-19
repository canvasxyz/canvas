# Canvas

[![tests](https://github.com/canvasxyz/canvas/actions/workflows/ci.yml/badge.svg)](https://github.com/canvasxyz/canvas/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/@canvas-js/core.svg)](https://www.npmjs.com/package/@canvas-js/core)
[![npm](https://img.shields.io/npm/v/@canvas-js/core?color=33cd56&logo=npm)](https://www.npmjs.com/package/@canvas-js/core)

Canvas is an embedded application database, similar to a
fully-distributed version of Firebase or Supabase.

It allows you to build multiplayer, real-time, and offline-first
applications, where each application is defined as a local
bundle that replicates and verifies all user interactions.

Canvas applications are easy to configure and have several useful properties:

- **Instant sync**. No transaction fees or confirmation wait times.
    Any number of peers can concurrently execute new actions, without
    waiting for consensus.
- **Real-time p2p**. Peers connect and sync directly with each other
    over libp2p, and use GossipSub topics to broadcast actions.
- **Eventually consistent and convergent**. Actions can freely read and
    write to a relational database. Every peer's database state will
    deterministically converge regardless of the order in which actions
    are received.
- **Self-authenticating**. Every action is signed by a session key
    authorized by a cryptographic identity, e.g. a Sign in with Ethereum
    address or `did:plc` identifier. The entire action log can be
    verified and replayed by anyone at any time; applications are
    trustless and portable.
- **Cross-platform**. Canvas apps run in the browser, server, or mobile
    devices. They persist data to IndexedDB in-browser, SQLite with
    on-disk storage, or Postgres with an in-memory Merkle index.
- **Open-source**. Built in the same spirit as libp2p and IPFS.

For more information, see the [Canvas documentation](https://docs.canvas.xyz).

## Using Canvas

To install the latest published CLI:

```
npm install -g @canvas-js/cli
```

## Commands

- `canvas init <path>`: Initialize a sample application
- `canvas info <path>`: Display application metadata
- `canvas run <path>`: Run an application
- `canvas export <path>`: Export the action log as JSON to stdout
- `canvas import <path>`: Import an action log from stdin

You can run each command with --help for more detailed documentation.

## Contributing

Canvas is currently developed and maintained by a small team. For
suggestions or contributions, we recommend first opening an issue or
discussing with an existing contributor before opening a pull request.

For information about how to build this repo, see DEVELOPING.md.

## License

MIT © Canvas Technologies, Inc.
