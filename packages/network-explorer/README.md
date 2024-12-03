# Common Network Explorer

## Setup

For development, the network explorer connects to `postgres://test@localhost/network-explorer`.
To set up a development database, use:

```
createuser test
createdb network-explorer -O test
```

Then run these commands in separate terminals.

```
npm run dev
```

```
npm run dev:server
```

## Deploying the server on Railway

Create a Railway space, and add the `canvasxyz/canvas` Github repo as a service.
Also create a Postgres database.

For the main service:

- Configure the build command to `npm run build && npm run build --workspace=@canvas-js/common-explorer`.
- Configure the start command to `npm start:server --workspace=@canvas-js/common-explorer`.
- Add DATABASE_URL, PORT, LIBP2P_PORT, LIBP2P_PRIVATE_KEY, BOOTSTRAP_LIST as environment variables.
- To use the network explorer, add two custom domains:
  - One should be connected to port 3333, for the network explorer API.
  - One should be connected to port 3334, for the libp2p service.

If you want other services to connect to the network explorer, look up the Peer ID by running `railway logs`,
  and then provide the other services with a multiaddr of the form:

```
/dns4/common-explorer-libp2p.mydomain.org/tcp/443/wss/p2p/12D3...
```
