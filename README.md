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
discussing with an existing contributor, before opening a pull request.

### Building

Canvas is configured as a composite TypeScript project using project
references and must be compiled with build mode turned on. Build all
core packages in parallel with:

```
npm run dev
```

To run the example app in development mode:

```
npm run dev-example-chat
```

### Using a development instance of Canvas

To use your local development version of Canvas in the CLI:

```
./install.sh
```

This will put a stub shell script at `$(npm config get prefix)/bin/canvas`
that calls `node ${PWD}/packages/canvas-cli/index.js $@`.

Note that if you are using system Node, writing to /usr/local/bin/canvas
will require sudo. In that case, you should install
[NVM](https://github.com/nvm-sh/nvm#installing-and-updating) and set your
default Node with `nvm alias default v18`.

### Publishing to NPM

Before publishing, make sure the project is in a clean state and passes tests:

```
$ npm run clean
$ npm run build
$ npm run test
```

Make sure you've commited your changes:

```
$ git status
$ git add .
$ git commit -m "made some changes"
```

There is a bug in the NPM CLI that causes some workspace packages to not update their dependencies to other workspace packages to the new version. As a workaround, we have a custom script in `version.sh` that sets the version and dependencies for all the modules in `packages/` and `examples/`. Pass an explicit a `0.0.X` version number as the first argument:

```
$ ./version.sh 0.0.X
```

Then make a manual commit just for the version bump, and publish the packages together:

```
$ git add .
$ git commit -m "v0.0.X"
$ npm run publish
```

When the bug is fixed, we should be able to replace the `version.sh` script with `npm version --git-tag-version=false --workspaces=true --include-workspace-root=true --workspaces-update=true --save --save-exact`.

### Linting and Code Formatting

We use `prettier` for code formatting. You should install the relevant
prettier extension for your code editor, which will automatically
rewrite files as you save them.

To format all code using prettier:

```
prettier -w .
```

### Testing

Run unit tests with `npm run test` from either the repo root or the `packages/canvas-core` directory.

If you have a a `.env` file **in the repo root** with two environment variables...

```
export ETH_CHAIN_ID=1
export ETH_CHAIN_RPC=https://mainnet.infura.io/v3/MY_API_KEY
```

... then `npm run test` will also run the contract call tests in `packages/canvas-core/test/contracts.test.ts`. If `.env` is missing these tests will be skipped.

To run a specific test:

```
npm run test test/sync.test.ts
```

This will try to run `test/sync.test.ts` in each workspace that is configured with tests.
