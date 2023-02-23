# Canvas

[![tests](https://github.com/canvasxyz/canvas/actions/workflows/ci.yml/badge.svg)](https://github.com/canvasxyz/canvas/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/@canvas-js/core.svg)](https://www.npmjs.com/package/@canvas-js/core)
[![npm](https://img.shields.io/npm/v/@canvas-js/core?color=33cd56&logo=npm)](https://www.npmjs.com/package/@canvas-js/core)

Canvas is a platform for decentralized applications, where every user
interaction is a signed message distributed over a [peer-to-peer
network](https://libp2p.io/). User actions are [efficiently
sychronized](https://github.com/canvasxyz/okra) and merged using
[collaborative data types](https://crdt.tech/), making it possible
to build decentralized applications with near-realtime responsiveness
and no token transactions.

Compared to using libp2p directly, Canvas provides:

* persistence
* efficient sync for past actions
* a concise language for defining applications, and upgrading between different versions
* a SQL database and customizable view functions
* a set of hooks for reading from chains
* support for a wide range of cryptographies/signature formats

Canvas is designed to be maximally interoperable and data-agnostic. We
expect to support a wide range of signed data formats, plus the
ability to sync Canvas networks to non-blockchain data sources.

For more information, see the [Canvas documentation](https://docs.canvas.xyz).

## Using Canvas

To install the latest published CLI:

```
npm install -g @canvas-js/cli
```

## Commands

- `canvas init [filename]`: Create a sample application for demonstration purposes.
- `canvas info [filename | CID]`: Show models, views, and actions for an application.
- `canvas run [filename | CID]`: Run a Canvas application.
- `canvas export [CID]`: Export actions from a Canvas application.
- `canvas import [CID]`: Import actions from a Canvas application.
- `canvas install [filename]`: Install a local spec file as a Canvas application.
- `canvas list`: List all installed Canvas applications.

You can run each command with --help for more detailed documentation.

## Contributing

Canvas is currently developed and maintained by a small team. For
suggestions or contributions, we recommend first opening an issue or
discussing with an existing contributor before opening a pull request.

For information about how to build this repo, see DEVELOPING.md.

## License

MIT © 2023 Canvas Technology Corporation
