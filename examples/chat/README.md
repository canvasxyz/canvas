# Chat Example

[Demo](https://chat-example.canvas.xyz/) - [Github](https://github.com/canvasxyz/canvas/tree/main/examples/chat)

The simple chat example implements a public messaging room over libp2p, with a persistence server.

<Iframe src="https://chat-example.canvas.xyz" />

## Contract

<<< @/../examples/chat/src/contract.ts

## Developing

- `npm run dev` to serve the frontend, on port 5173.
- `npm run build` to build a static bundle, which is required for the next steps.
- `npm run dev:server` to start the backend with in-memory temporary state, on port 8080.
- `npm run dev:server:persistent` to start the backend with data persisted to a directory in /tmp.
- `npm run dev:server:reset` to clear the persisted data.

## Deploying to Railway

Create a Railway space based on the root of this Github workspace
(e.g. canvasxyz/canvas).

Set the railway config to `examples/chat/railway.json`. This will
configure the start command, build command, and watch paths.

Configure networking for the application:
- Port 8080 should map to the websocket server defined in VITE_CANVAS_WS_URL (e.g. chat-example.canvas.xyz).
- Port 4444 should map to a URL where your libp2p service will be exposed. (e.g. chat-example-libp2p.canvas.xyz).

Configure environment variables:
- ANNOUNCE (e.g. /dns4/chat-example-libp2p.canvas.xyz/tcp/443/wss)
- DATABASE_URL
- LIBP2P_PRIVATE_KEY (try: node ./scripts/generateLibp2pPrivkey.js)
- DEBUG (optional, for logging)