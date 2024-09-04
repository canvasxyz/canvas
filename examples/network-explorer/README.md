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

## Deploying the server on Railway

Create a Railway space, and add the `canvasxyz/canvas` Github repo as a service.
Also create a Postgres database.

For the main service:

- Configure the build command to `npm run build`.
- Configure the start command to `npm start:server --workspace=@canvas-js/network-explorer`.
- Add the DATABASE_URL as a environment variable, pointed to the Postgres database.
- To check the app is working, add Public Networking using a Railway provided domain to port 8080.
- To use the network explorer, add two custom domains:
  - One should be connected to port 8080, for the network explorer API.
  - One should be connected to port 3334, for the libp2p service.
- If you want the network explorer to connect to another server, set a BOOTSTRAP_LIST as the environment variable.
- If you want other services to connect to the network explorer, look up the Peer ID by running `railway logs`,
  and then provide the other services with a multiaddr of the form:

```
/dns4/network-explorer-libp2p.mydomain.org/tcp/443/wss/p2p/12D3...
```

## Deploying the frontend on Vercel

Create a Vercel app from this directory.

Configure the build command to `cp tsconfig.vercel.json tsconfig.json && vite build`.

Copy .env.example to .env and set the API base URL to the backend that you've set up above.

Then deploy the frontend:

```
vercel --prod
```

## Connecting to the service via CLI

Use the lib2p address of the network explorer:

```
npm install -g @canvas-js/cli
canvas run example.contract.js --bootstrap="/dns4/network-explorer-libp2p.mydomain.org/tcp/443/wss/p2p/12D3..."
```

## Configuration Options

- BOOTSTRAP_LIST: list of libp2p peers to dial (defaults to a canvas-chat.fly.dev node)
- DATABASE_URL: a postgres database to connect to (default postgres://test@localhost/network-explorer)
- PORT: port to serve the network API on (default 3333)
- LIBP2P_PORT: port to bind libp2p on (default 3334)
- NODE_ENV: development or production
- TOPICS: unused
