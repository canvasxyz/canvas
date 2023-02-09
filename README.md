# Canvas

[![tests](https://github.com/canvasxyz/canvas/actions/workflows/ci.yml/badge.svg)](https://github.com/canvasxyz/canvas/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/@canvas-js/core.svg)](https://www.npmjs.com/package/@canvas-js/core)
[![npm](https://img.shields.io/npm/v/@canvas-js/core?color=33cd56&logo=npm)](https://www.npmjs.com/package/@canvas-js/core)

Canvas is a peer-to-peer backend for decentralized applications,
where every user interaction is a signed message distributed over
[libp2p](https://libp2p.io/). Every user action is [efficiently
synchronized](https://github.com/canvasxyz/okra) using [collaborative
data types](https://crdt.tech/) and merged into SQLite databases.

Unlike libp2p, Canvas provides:

* persistence
* efficient sync for past actions
* the ability to read from chains
* a concise language for expressing different versions of applications, and upgrading between them
* built-in support for a wide range of cryptographies and signature formats

Unlike Web3 databases and data blockchains, Canvas does not lock you
into any proprietary data formats, nor will it ever require you to use
a token. Canvas is built to be neutral infrastructure that enables a
wide range of protocols to be constructed on top of it.

For more information, see the [Canvas
documentation](https://canvasxyz.github.io/canvas-docs/docs).

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

## Contributing to Canvas

Canvas is currently developed and maintained by a small team. For
suggestions or contributions, we recommend first opening an issue or
discussing with an existing contributor before opening a pull request.

For information about how to build this repo, see DEVELOPING.md.
