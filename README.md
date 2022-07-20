# Canvas

Canvas is a P2P protocol for building decentralized, frontend-independent applications, where every user action is a signed message from an cryptographic address.

## Using Canvas

**You must must use Node v16**. Later versions are impacted by [this bug](https://github.com/ethers-io/ethers.js/issues/3082) ultimately caused by Node's internal OpenSSL library.

To install the latest published CLI:

```
npm install -g @canvas-js/cli
```

To use your local development version of Canvas as the CLI:

```
./install.sh
```

This will put a stub shell script at `$(npm config get prefix)/bin/canvas` that calls `node ${PWD}/packages/canvas-cli/index.js $@`.

Note that if you are using system Node, writing to /usr/local/bin/canvas will require sudo. In that case, you should install NVM and set your default Node with `nvm alias default v16`.

Inspecting specs:

- `canvas info [spec]`: Show the models, views, and actions for a spec.
- `canvas list`: List all specs in the data directory.
- `canvas list actions [spec]`: List recent actions, for a spec.
- `canvas list sessions [spec]`: List recent sessions, for a spec.

Running and managing specs:

- `canvas init [spec.js]`
- `canvas run [spec]`
- `canvas download [CID]`

To create a new session, generate a new session_public_key, insert it
into a signed payload, and sign the payload with your wallet address:

```
POST /sessions { signature, payload: { from, spec, timestamp, session_public_key, session_duration } }
```

To apply an action directly from your wallet address:

```
POST /actions { session: null, signature, payload: { from, spec, timestamp, call, args } }
```

To apply an action using a session key:

```
POST /actions { session, signature, payload: { from, spec, timestamp, call, args } }
```

## Developing

The CLI is written in pure JS and doesn't require compilation.

canvas-interfaces, canvas-core, and canvas-hooks are configured as a composite TypeScript project using project references and must be compiled with build mode turned on. Build all three in parallel with

```
npm run dev
```

To run the example app in development mode:

```
npm run dev-example
```

Build and publish the Canvas packages:

```
npm run build
npm run publish-cli
npm run publish-core
npm run publish-hooks
npm run publish-interfaces
```
