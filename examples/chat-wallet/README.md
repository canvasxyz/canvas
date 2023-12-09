# Interwallet Messaging

## Development

This package has the source for both a client single-page web app and a replication server. You don't need to run the server to run the client.

### Client app

Create an env file `.env.development` (inside `interwallet/`) exporting the multiaddr of a local [bootstrap sever](https://github.com/canvasxyz/bootstrap-peer) as `VITE_BOOTSTRAP_LIST`:

```sh
# .env.development
VITE_BOOTSTRAP_LIST="/ip4/127.0.0.1/tcp/8080/ws/p2p/12D..."
```

Then run `pnpm run client:dev` to start the development server with hot reloading.

### Replication server

Create an env file `.env.server` (inside `interwallet/`) exporting the same bootstrap server multiaddr as `BOOTSTRAP_LIST`:

```sh
# .env.server
BOOTSTRAP_LIST="/ip4/127.0.0.1/tcp/8080/ws/p2p/12D3KooWKEW6KAnhn7Sr4gh9nxvwCmeTY83xrfLqTJSmgvTpauCx"
DEBUG="canvas:*"
DATA_DIRECTORY="./data/"
```

Then run `pnpm run server:start` to start the replication server.
