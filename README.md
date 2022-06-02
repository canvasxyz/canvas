# Canvas

Canvas is a P2P protocol for building decentralized, frontend-independent applications,
where every user action is a signed message from an cryptographic address.

## Using Canvas

To install the latest published CLI:

```
npm install -g @canvas-js/cli
```

To use your local development version of Canvas as the CLI:

```
./install.sh
```

This just puts a stub shell script at `$(npm config get prefix)/bin/canvas` that calls `node ${PWD}/packages/canvas-cli/index.js $@`.

Inspecting specs:

- `canvas info [spec]`: Show the models, views, and actions for a spec.
- `canvas list`: List all specs in the data directory.
- `canvas list actions [spec]`: List recent actions, for a spec.
- `canvas list sessions [spec]`: List recent sessions, for a spec.

Running and managing specs:

- `canvas init [spec.js]`
- `canvas run [spec]`
- `canvas download [multihash]`

To create a new session, generate a new session_public_key, insert it
into a signed payload, and sign the payload with your wallet address:

```
POST /sessions { from, signature, payload: { from, spec, timestamp, session_public_key, session_duration } }
```

To apply an action directly from your wallet address:

```
POST /actions { from, signature, payload: { from, spec, timestamp, call, args } }
```

To apply an action using a session key:

```
POST /actions { from, session, signature, payload: { from, spec, timestamp, call, args } }
```

## Developing

Compile the core, CLI, and React hooks, and run the example app in development mode:

```
npm run dev
```

Build and publish the Canvas packages:

```
npm run build
npm run publish-cli
npm run publish-core
npm run publish-hooks
```
