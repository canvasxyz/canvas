# Canvas

Canvas is a new architecture for decentralized applications, where
every user interaction is a signed message exchanged over a
peer-to-peer network.

For more information, see the [Canvas docs](https://canvasxyz.github.io/canvas-docs/docs)!

## Using Canvas

To install the latest published CLI:

```
npm install -g @canvas-js/cli
```

## Commands

- `canvas init [filename]`: Create a sample application for demonstration purposes.
- `canvas info [filename | multihash]`: Show models, views, and actions for an application.
- `canvas run [filename | multihash]`: Run a Canvas application.
- `canvas export [filename | multihash]`: Export actions from a Canvas application.
- `canvas import [filename | multihash]`: Import actions from a Canvas application.
- `canvas list`: List all local SQLite databases for Canvas applications.

You can run each command with --help for more detailed documentation.

## Developing Canvas

To use your local development version of Canvas as the CLI:

```
./install.sh
```

This will put a stub shell script at `$(npm config get prefix)/bin/canvas`
that calls `node ${PWD}/packages/canvas-cli/index.js $@`.

Note that if you are using system Node, writing to /usr/local/bin/canvas
will require sudo. In that case, you should install
[NVM](https://github.com/nvm-sh/nvm#installing-and-updating) and set your
default Node with `nvm alias default v18`.

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

### Publishing to NPM

Build and publish the Canvas packages:

```
npm i
git add .
git commit -m "version bump"   # In this order, to ensure package-lock.json is up-to-date
npm run clean
npm run build
npm run publish-cli &&
  npm run publish-core &&
  npm run publish-hooks &&
  npm run publish-interfaces
```

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
