# Chat Example

[Demo](https://chat-example.canvas.xyz/) - [Github](https://github.com/canvasxyz/canvas/tree/main/examples/chat)

The simple chat example implements a public messaging room
with persistence over libp2p.

```ts
export const models = {
  message: {
    id: "primary",
    address: "string",
    content: "string",
    timestamp: "integer",
    $indexes: ["user", "timestamp"],
  },
}

export const actions = {
  async createMessage(db, { content }, { id, address, timestamp }) {
    await db.set("message", { id, address, content, timestamp })
  },
}
```

## Server

Run `npm run dev:server` to start a temporary in-memory server, or
`npm run start:server` to persist data to a `.cache` directory.

To deploy the replication server:

```
$ cd server
$ fly deploy
```

If you are forking this example, you should change:

- the Fly app name
- the `ANNOUNCE` environment variable to match your Fly app name

## Running the Docker container locally

Mount a volume to `/data`. Set the `PORT`, `LISTEN`, `ANNOUNCE`, and
`BOOTSTRAP_LIST` environment variables if appropriate.

## Deploying to Railway

Create a Railway space based on the root of this Github workspace (e.g. canvasxyz/canvas).

* Custom build command: `npm run build && VITE_CANVAS_WS_URL=wss://chat-example.canvas.xyz npm run build --workspace=@canvas-js/example-chat`
* Custom start command: `./install-prod.sh && canvas run /tmp/canvas-example-chat --port 8080 --static examples/chat/dist --topic chat-example.canvas.xyz --init examples/chat/src/contract.ts`
* Watch paths: `/examples/chat/**`
* Public networking:
  * Add a service domain for port 8080.
  * Add a service domain for port 4444.
* Watch path: `/examples/chat/**`. (Only build when chat code is updated, or a chat package is updated.)
