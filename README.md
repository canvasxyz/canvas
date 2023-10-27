# Canvas

[![tests](https://github.com/canvasxyz/canvas/actions/workflows/ci.yml/badge.svg)](https://github.com/canvasxyz/canvas/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/@canvas-js/core.svg)](https://www.npmjs.com/package/@canvas-js/core)
[![npm](https://img.shields.io/npm/v/@canvas-js/core?color=33cd56&logo=npm)](https://www.npmjs.com/package/@canvas-js/core)

Canvas is a framework for making real-time decentralized applications.

Canvas apps are built on a programmable multi-writer relational database. They're easy to configure and automatically have several useful properties:

- **Off-chain**. No transaction fees or confirmation wait times. Any number of peers can concurrently execute new actions, without waiting for consensus.
- **Real-time p2p**. Peers connect and sync directly with each other over libp2p, and use GossipSub topics to broadcast actions.
- **Eventually consistent**. Actions can freely read and write to a relational database. Every peer's database state will deterministically converge regardless of the order in which the actions are received.
- **Self-authenticating**. Every action is signed by a session key authorized by an end user identity, using e.g. SIWE for Ethereum identities. The entire action log can be verified and replayed by anyone at any time; applications are trustless and portable.
- **Cross-platform**. Canvas apps run in the browser or on NodeJS, persisting data with IndexedDB and SQLite/LMDB, respectively.

Canvas is designed to be maximally interoperable and data-agnostic. We expect to support a wide range of signed data formats, plus the ability to sync Canvas networks to non-blockchain data sources.

For more information, see the [Canvas documentation](https://docs.canvas.xyz).

## Using Canvas

To install the latest published CLI:

```
npm install -g @canvas-js/cli
```

## Commands

- `canvas init <path>`: Initialize a sample application
- `canvas info <path | filename>`: Display application metadata
- `canvas run <path | filename>`: Run an application
- `canvas export <path>`: Export the action action to stdout
- `canvas import <path>`: Import an action log from stdin

You can run each command with --help for more detailed documentation.

## Contributing

Canvas is currently developed and maintained by a small team. For
suggestions or contributions, we recommend first opening an issue or
discussing with an existing contributor before opening a pull request.

For information about how to build this repo, see DEVELOPING.md.

## License

MIT © 2023 Canvas Technologies, Inc.
