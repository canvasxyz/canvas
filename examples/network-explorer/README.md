# Network Explorer Example

## Setup

For development, the network explorer connects to `postgres://test@localhost/network-explorer`.
To set up a development database, use:

```
createuser test
createdb network-explorer -O test
```

Then run these commands in separate terminals. (You may also want to
be running `npm dev` from the workspace root directory, in a third terminal.)

```
npm run dev:server
```

```
npm run dev:client
```

## Deploying on Railway

Create a Railway space, and add the `canvasxyz/canvas` Github repo as a service.
Also create a Postgres database.

For the main service:

- Configure the build command to `npm run build`.
- Configure the start command to `npm start:server --workspace=@canvas-js/network-explorer`.
- Add the DATABASE_URL as a environment variable, pointed to the Postgres database.

- Peering?
- Exposing a port to the web?
- Topics list?
- Testing with a CLI?
  - Is it easy to see what the Peer ID is? Where it's bound?

## Configuration

- BOOTSTRAP_LIST: list of libp2p peers to dial (defaults to a canvas-chat.fly.dev node)
- PORT: port to serve the network API on (default 3333)
- LIBP2P_PORT: port to bind libp2p on (default 3334)
- DATABASE_URL: a postgres database to connect to (default postgres://test@localhost/network-explorer)
- NODE_ENV
- TOPICS
