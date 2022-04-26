# Canvas

Canvas is a P2P protocol for building decentralized,
frontend-independent applications, where every action in the
application is a signed message from an Ethereum address.

## Using Canvas

To install the CLI:

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

- [TODO] `canvas run [spec] [--peer=peer.canvas.xyz]`
- [TODO] `canvas download [multihash] [--peer=peer.canvas.xyz]`
- [TODO] `canvas test [spec] [--tests=tests.js]`
- [TODO] `canvas fixtures load [spec] [--fixture=fixtures.js]`
- [TODO] `canvas migrate [old-spec] [new-spec] [--dry-run]`

To create a new session, generate a new session_public_key, insert it
into a signed payload, and sign the payload with your wallet address:

```
POST / { from, signature, payload: { from, spec, timestamp, session_public_key, session_duration } }
```

To apply an action directly from your wallet address:

```
POST / { from, signature, payload: { from, spec, timestamp, call, args } }
```

To apply an action using a session key:

```
POST / { from, session, signature, payload: { from, spec, timestamp, call, args } }
```

## Running the hub

Start an IPFS daemon in a separate terminal

```
$ ipfs daemon --offline
```

Install dependencies and symlink the local packages:

```
$ npm i
```

Create a `packages/canvas-hub/.env` file with `DATABASE_URL` and `APP_DIRECTORY` environement variables:

```
DATABASE_URL=file:./db.sqlite
APP_DIRECTORY=./apps
```

Generate the prisma client:

```
$ cd packages/canvas-hub
$ npx prisma generate
$ cd ../..
```

The `dev` script in the repo run runs the NextJS dev server and TypeScript compilers for canvas-core and canvas-cli, all in parallel:

```
$ npm run dev
```

## Deploying the hub

Build the core, CLI, and hub projects:

```
$ npm run build
```

Start the hub production NextJS server:

```
$ npm run start
```
